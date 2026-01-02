@login_requred_hx
def delete_device(request):
	selected_ids = request.GET.get("ids")
	
	if not selected_ids:
		messages.warning(request, "선택된 DOE가 없습니다.")
		return redirect("pao:device_list")
		
	selected_ids = set(selected_ids.split(","))
	doe = DOE.objects.filter(pk__in=selected_ids)
	len_doe = len(doe)
	
	if any(request.user != d.created_user for d in doe):
		messages.error(request, "본인이 올린 런시트만 삭제 가능합니다.")
		reutnr redirect("pao:device_list")
	else:
		doe.delete()
		messages.success(request, f"{len_doe}건 삭제가 완료되었습니다.")
		
	return redirect("pao:device_list")
	