from rest_framework import serializers
from .models import Report, ReportEntry, ReportFile, CalculatedField, ReportAccessLog

class ReportFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportFile
        fields = ['id', 'file', 'uploaded_at', 'uploaded_by']

class ReportEntrySerializer(serializers.ModelSerializer):
    files = ReportFileSerializer(many=True, read_only=True)

    class Meta:
        model = ReportEntry
        fields = ['id', 'title', 'content', 'created_at', 'updated_at', 'created_by', 'last_modified_by', 'files', 'order']

class CalculatedFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalculatedField
        fields = ['id', 'name', 'formula', 'created_by', 'created_at']

class ReportSerializer(serializers.ModelSerializer):
    entries = ReportEntrySerializer(many=True, read_only=True)
    calculated_fields = CalculatedFieldSerializer(many=True, read_only=True)

    class Meta:
        model = Report
        fields = ['id', 'name', 'description', 'created_at', 'updated_at', 'created_by', 'last_modified_by', 'is_archived', 'is_template', 'schedule', 'last_run', 'entries', 'calculated_fields']

    def validate_name(self, value):
        if not value or not isinstance(value, str):
            raise serializers.ValidationError("Report name must be a non-empty string.")
        return value

    def validate(self, data):
        # Add any cross-field validation here if needed
        return data

class ReportAccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportAccessLog
        fields = ['id', 'report', 'user', 'accessed_at', 'action']
