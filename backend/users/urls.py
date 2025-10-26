from django.urls import path
from . import views

urlpatterns = [
    path('lookup-user/', views.lookup_user_by_username, name='lookup_user_by_username'),
    path('create-user/', views.create_user_record, name='create_user_record'),
    path('user-profile/', views.get_user_profile, name='get_user_profile'),
    path('user-profile/update/', views.update_user_profile, name='update_user_profile'),
    path('dashboard/', views.dashboard_summary, name='dashboard_summary'),
    path('ask/', views.ask, name='users_ask'),
]
