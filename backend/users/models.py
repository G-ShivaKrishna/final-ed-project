from django.db import models

class SupabaseUser(models.Model):
    id = models.UUIDField(primary_key=True)
    # The Supabase `users` table used by this project does not have an `auth_user_id` column
    # Remove that field here so Django admin/listing queries don't reference a non-existent column.
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150)
    role = models.CharField(max_length=50, blank=True, null=True)
    major = models.CharField(max_length=150, blank=True, null=True)
    phone_number = models.CharField(max_length=50, blank=True, null=True)
    # The Supabase column name for college may be case-sensitive ("College"). Use db_column to map it.
    college = models.CharField(max_length=200, blank=True, null=True, db_column='College')
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'users'
