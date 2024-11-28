from rest_framework import serializers
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import validators
from .models import CustomUser, Role, Permission
from .models import UserPreference, Insight
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
import logging
logger = logging.getLogger(__name__)


class PermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for the Permission model.
    """
    class Meta:
        model = Permission
        fields = ['id', 'name', 'description', 'category', 'is_active']


class RoleSerializer(serializers.ModelSerializer):
    """
    Serializer for the Role model.
    """
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions', 'permission_ids']

    def create(self, validated_data):
        permission_ids = validated_data.pop('permission_ids', [])
        role = Role.objects.create(**validated_data)

        if permission_ids:
            role.permissions.set(permission_ids)

        return role

    def update(self, instance, validated_data):
        permission_ids = validated_data.pop('permission_ids', [])
        instance = super().update(instance, validated_data)
        if permission_ids is not None:
            instance.permissions.set(permission_ids)
        return instance


class RoleAssignmentSerializer(serializers.Serializer):
    """
    Serializer for assigning roles to users
    """
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(),
        required=True
    )
    role_ids = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        many=True,
        required=True
    )

class UserRoleSerializer(serializers.ModelSerializer):
    """
    Extended User Serializer to include role management with enhanced validation
    """
    roles = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        many=True,
        required=False
    )

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 
            'last_name', 'roles', 'is_active'
        ]
        read_only_fields = ['id', 'username', 'email']

    def validate_roles(self, roles):
        """
        Additional validation for roles
        - Ensure unique roles
        - Optionally add any custom role assignment logic
        """
        # Remove duplicates while preserving order
        unique_roles = list(dict.fromkeys(roles))

        if len(unique_roles) > 5:  # Adjust as needed
            raise serializers.ValidationError("Maximum of 5 roles allowed")

        return unique_roles

    def update(self, instance, validated_data):
        """
        Enhanced role update method with logging and validation
        """
        # Extract roles, defaulting to None if not provided
        roles = validated_data.pop('roles', None)
        
        # Update other user fields
        instance = super().update(instance, validated_data)
        
        # Set roles if provided
        if roles is not None:
            # Log role changes (optional, but helpful for audit trails)
            old_roles = set(instance.roles.values_list('id', flat=True))
            new_roles = set(role.id for role in roles)
            
            # Perform role update
            instance.roles.set(roles)
            
            # Optional: Add logging or additional processing
            added_roles = new_roles - old_roles
            removed_roles = old_roles - new_roles
            
            # Log changes (you could integrate with your logging system)
            if added_roles or removed_roles:
                logger.info(f"User {instance.username} roles updated. "
                            f"Added: {added_roles}, Removed: {removed_roles}")
        
        return instance

    def to_representation(self, instance):
        """
        Customize the representation to ensure consistent role data
        """
        representation = super().to_representation(instance)
        
        # Ensure roles are represented consistently
        representation['roles'] = [
            role.id for role in instance.roles.all()
        ]
        
        return representation

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the CustomUser model.
    """
    roles = RoleSerializer(many=True, read_only=True)

    def validate_email(self, value):
        """
        Validate email using Django's built-in email validation
        """
        try:
            validate_email(value)
            return value
        except ValidationError:
            raise serializers.ValidationError("Invalid email address")

    def validate_username(self, value):
        if not value:
            raise serializers.ValidationError("Username cannot be empty")
        return value

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'roles']
        read_only_fields = ['id']
        extra_kwargs = {
            'email': {'validators': [validate_email]}
        }


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = ['dark_mode', 'notification_frequency']

class InsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insight
        fields = ['id', 'title', 'description', 'created_at']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer specifically used for user registration.
    """
    password = serializers.CharField(write_only=True, validators=[validate_password])
    email = serializers.EmailField(validators=[validators.EmailValidator()])
    phone_number = serializers.CharField(validators=[
        validators.RegexValidator(
            regex=r'^\+?1?\d{9,15}$',
            message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
        )
    ])

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'phone_number']

    def validate_username(self, value):
        if CustomUser.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def create(self, validated_data):
        user = CustomUser.objects.create_user(**validated_data)
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Serializer for requesting a password reset.
    """
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            user = CustomUser.objects.get(email=value)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("No user is registered with this email address.")
        return value


class PasswordResetSerializer(serializers.Serializer):
    """
    Serializer for resetting the password.
    """
    uidb64 = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            uid = urlsafe_base64_decode(attrs['uidb64']).decode()
            user = CustomUser.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
            raise serializers.ValidationError("Invalid token or user ID")

        if not default_token_generator.check_token(user, attrs['token']):
            raise serializers.ValidationError("Invalid token")

        return attrs

    def save(self, **kwargs):
        uid = urlsafe_base64_decode(self.validated_data['uidb64']).decode()
        user = CustomUser.objects.get(pk=uid)
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user
