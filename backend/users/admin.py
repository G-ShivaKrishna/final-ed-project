from django.contrib import admin
from .models import SupabaseUser

@admin.register(SupabaseUser)
class SupabaseUserAdmin(admin.ModelAdmin):
    list_display = ('id', 'email', 'username', 'role', 'created_at')
