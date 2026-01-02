@admin.register(ProfileTVAdditions)
class ProfileTVAdditionsAdmin(admin.ModelAdmin):
    list_display = ["id", "analysis_profile", "color_filter", "line_factor", "aging_time", "modified_by"]
    search_fields = ["analysis_profile__title"]
    readonly_fields = ["created_at", "updated_at", "created_user"]