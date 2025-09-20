from rest_framework import serializers
from .models import Course, CourseInvitation, SupabaseUser

class SupabaseUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupabaseUser
        fields = ['id', 'username', 'role', 'created_at']

class CourseSerializer(serializers.ModelSerializer):
    instructor = SupabaseUserSerializer(read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'name', 'instructor', 'created_at']

class CourseInvitationSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    student = SupabaseUserSerializer(read_only=True)

    class Meta:
        model = CourseInvitation
        fields = [
            'id',
            'course',
            'student',
            'status',
            'invitation_token',
            'sent_at',
            'responded_at',
        ]
        read_only_fields = ['status', 'invitation_token', 'sent_at', 'responded_at']
