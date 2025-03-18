import os
import environ
from pathlib import Path
import dj_database_url
import tempfile
import sys

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize environment variables
env = environ.Env(
       DJANGO_DEBUG=(bool, False),
       DJANGO_SECRET_KEY=(str, None),
       DJANGO_ALLOWED_HOSTS=(list, []),
       DB_NAME=(str, None),
       DB_USER=(str, None),
       DB_PASSWORD=(str, None),
       DB_HOST=(str, 'localhost'),
       DB_PORT=(int, 3306),
       EMAIL_BACKEND=(str, 'django.core.mail.backends.smtp.EmailBackend'),
       EMAIL_HOST=(str, 'smtp.gmail.com'),
       EMAIL_PORT=(int, 587),
       EMAIL_USE_TLS=(bool, True),
       EMAIL_HOST_USER=(str, ''),
       EMAIL_HOST_PASSWORD=(str, ''),
       SITE_URL=(str, 'http://localhost:8000')
   )

# reading .env file
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

JWT_SECRET = env('JWT_SECRET', default=None)

if not JWT_SECRET:
    raise ValueError("Missing JWT_SECRET! Please set it in your .env file.")

SITE_URL = env('SITE_URL')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('DJANGO_SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

# Email Configuration
EMAIL_BACKEND = env('EMAIL_BACKEND')
EMAIL_HOST = env('EMAIL_HOST')
EMAIL_PORT = env('EMAIL_PORT', cast=int)
EMAIL_USE_TLS = env('EMAIL_USE_TLS', cast=bool)
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': 'debug.log',
            'formatter': 'verbose'
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'simple'
        }
    },
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{'
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{'
        }
    },
    'loggers': {
        'django': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
        'reports': {
            'handlers': ['file', 'console'],
            'level': 'DEBUG',
            'propagate': True,
        }
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# Currency settings
CURRENCY_SYMBOL = '₦'
CURRENCY_DECIMAL_PLACES = 2
USE_THOUSAND_SEPARATOR = True
THOUSAND_SEPARATOR = ','
DECIMAL_SEPARATOR = '.'

# Configure django-user-agents to use caching
USER_AGENTS_CACHE = 'default'

COMPANY_NAME = "verifi"
COMPANY_LOGO_URL = BASE_DIR / 'static' / 'Logo 10.png'


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'daphne',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'inspection',
    'core',
    'transactions',
    'invoices',
    'users',
    'products',
    'reports',
    'receipts',
    'stock_adjustments',
    'django_filters',
    'reportlab',
    'drf_yasg',
    'channels',
    'django_extensions',
    'django_user_agents',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django_user_agents.middleware.UserAgentMiddleware',
    'core.middleware.VisitTrackingMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("127.0.0.1", 6379)],
        },
    },
}


# Database
# https://docs.djangoproject.com/en/3.2/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': env('MYSQL_DB'),
        'USER': env('MYSQL_USER'),
        'PASSWORD': env('MYSQL_PASSWORD'),
        'HOST': env('MYSQL_HOST', default='localhost'),
        'PORT': env('MYSQL_PORT', default='3306'),
    }
}


# Password validation
# https://docs.djangoproject.com/en/3.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

AUTH_USER_MODEL = 'users.CustomUser'

# Internationalization
# https://docs.djangoproject.com/en/3.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.2/howto/static-files/
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]


# Configure media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'test_media')

TESTING = 'test' in sys.argv

# Default primary key field type
# https://docs.djangoproject.com/en/3.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS settings
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Rest Framework Configuration
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'utils.errorHandler.custom_exception_handler',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ),
    'DEFAULT_CONTENT_NEGOTIATION_CLASS': 'rest_framework.negotiation.DefaultContentNegotiation',
}
