from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Report, ReportEntry, ReportFile


class ReportFileInline(admin.TabularInline):
    model = ReportFile


class ReportEntryInline(admin.StackedInline):
    model = ReportEntry
    extra = 1
    inlines = [ReportFileInline]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at', 'updated_at')
    search_fields = ('name', 'description')
    inlines = [ReportEntryInline]


@admin.register(ReportEntry)
class ReportEntryAdmin(admin.ModelAdmin):
    list_display = ('title', 'report', 'created_at', 'updated_at')
    list_filter = ('report', 'created_at', 'updated_at')
    search_fields = ('title', 'content')
    inlines = [ReportFileInline]


@admin.register(ReportFile)
class ReportFileAdmin(admin.ModelAdmin):
    list_display = ('file', 'entry', 'uploaded_at')
    list_filter = ('uploaded_at',)
    search_fields = ('file',)
