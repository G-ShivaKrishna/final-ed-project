from django.db import models

class SupabaseUser(models.Model):
    id = models.UUIDField(primary_key=True)
    auth_user_id = models.UUIDField()
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150)
    role = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'users'
