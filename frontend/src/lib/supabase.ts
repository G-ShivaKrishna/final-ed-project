import supabaseDefault from '../supabaseClient';

export const supabase = supabaseDefault;

export type UserProfile = {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  sortable_name?: string;
  pronouns?: string;
  language?: string;
  timezone?: string;
};

export type NotificationSetting = {
  id: string;
  user_id: string;
  setting_type: string;
  email_enabled: boolean;
  push_enabled: boolean;
};

export type Course = {
  id: string;
  code?: string;
  color?: string;
};

export type Assignment = {
  id: string;
  due_date: string;
  status: string;
  completed_items?: number;
  course_id?: string;
  course?: Course;
};

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    // supabase-js v2
    // { data: { user }, error }
    // If the project uses an older supabase client, this may need to be adjusted.
    // First, try to get the user from auth
    // @ts-ignore
    const maybeGetUser = (supabase.auth && supabase.auth.getUser) ? await supabase.auth.getUser() : null;

    // @ts-ignore
    const user = maybeGetUser?.data?.user ?? (supabase.auth && (supabase.auth.user ? supabase.auth.user() : null));

    if (!user) return null;

    // Supabase project uses `users` table for profile information (id, email, username, role, etc.)
    const { data } = await supabase
      .from('users')
      .select('id, email, username, role, major, phone_number, "College"')
      .eq('id', user.id)
      .maybeSingle();

    const profile = data
      ? {
          id: data.id,
          email: data.email,
          full_name: data.username,
          display_name: data.username,
          sortable_name: data.username,
          // keep other optional fields in a more generic location if needed
        }
      : null;

    return profile as UserProfile | null;
  } catch (err) {
    console.error('getCurrentUserProfile error', err);
    return null;
  }
};

export const getNotificationSettings = async (userId: string): Promise<NotificationSetting[]> => {
  const { data } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId);

  return (data as NotificationSetting[]) || [];
};

export default supabase;
