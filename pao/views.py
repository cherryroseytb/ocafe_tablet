from pao.utils.fitting_lt import LT_Processor
from pao.utils.plotly_po import LTPlotlyProcessor

class selected_does_lt(LoginRequiredMixin, View):
    def get(self, request, *Args, **kwargs):
        selected_data, lt_list = [], []
        chart_flag = bool(request.GET.get("chart", True))
        table_flag = bool(request.GET.get("table", True))
        msg = {"tag": "success", "message": "수명데이터 불러오기 완료"}
        ids_key = trquest.GET.get("ids")
        self.aging_time = float(request.GET.get("aging_time", 0))
        self.lt_plotly_processor = LTPlotlyProcessor()
        if not ids_key:
            return JsonResponse([], safe=False)
            
        tag, doe_result = get_selected_doe(request, prefetch_fields="lt_set")
        match tag:
            case "warning":
                msg["tag"] = tag
                msg["message"] = doe_result
                
            case "success":
                lt_expts = [l for d in doe_result for l in d.lt_set.all()]
                
                for lt_idx, lt_expt in enumerate(lt_expts):
                    try:
                        if chart_flag:
                            lt_list.extend(Self.get_lt_graph(lt_expt, lt_idx))
                        if table_flag:
                            selected_data.extemd(self.get_lt_table(lt_expt))
                            
                    except Exception as e:
                        msg["tag"] = "error"
                        msg["message"] += (f"<br>Error processing LT Id {lt_expt.id}: {e}")
                        continue
        return JsonResponse(
            {
                "lt_data": lt_list,
                "lt_layout": self.lt_plotly_processor.lt_layout,
                "selected_data": selected_data,
                **msg,
            })
            
    def get_lt_graph(self, lt, lt_idx):
        lt_list = []
        processor = LT_Processor(lt.expt, self.aging_time)
        
        self.lt_plotly_processor.lt_processed = {
            "lt": processor.time_lum_array(),
            "lt_id": lt.lt_id,
        }
        self.lt_plotly_processor.index = lt_idx
        lt_list.extend(self.lt_plotly_processor.get_lt())
        return lt_list
        
    def get_lt_table(self, lt):
        selected_data = []
        processor = LT_Processor(lt_expt, self.aging_time)
        processor.check_progress()
        fit_result = processor.get_LT()
        selected_data.append(
            {
                "id": lt.id,
                "doe_id": lt.doe_id,
                "lt_id": lt.lt_id,
                "condition": lt.doe.condition,
                "color": lt.doe.color,
                "updated_at": lt.updated_at.date(),
                **fir_result,
            })
        return selected_data
        
selected_does_lt = selected_does_lt.as_view()

@login_required_hx
def device_detail(request, pk):
	doe = get_object_or_404(DOE.objects.prefetch_related("ivl_set", "lt_set", "cv_set", "iv_set", "angle_set"), pk=pk)
	check_perm = permission_closure(request)
	if not check_perm(doe):
		messages.warning(request, "해당DOE에 대한 권한이 없습니다.")
		return redirect(reverse_lazy("pao:device_list"))
		
	from_page = request.GET.get("from")
	profile_id = request.GET.get("profile_id")
	ids = request.GET.get("ids")
	
	session_key_raw = f"device_detail_{pk}_{request.user.id}"
	session_key = hashlib.sha256(session_key_raw.encode()).hexdigest()
	
	if from_page == "compare_tv" and profile_id and ids:
		request.session[session_key] = {
			"from": from_page,
			"profile_id": profile_id,
			"ids": ids,
		}
	elif session_key in request.session:
		referer = request.META.get("HTTP_REFERER", "")
		current_url = request.build_absolute_uri()
		device_detail_url = request.build_absolute_uri(
			reverse_lazy("pao:device_detail", kwargs={"pk":pk})
		)
		
		allowed_referers = [
			reverse_lazy("pao:device_list"),
			reverse_lazy("pao:compare_tv"),
		]
		
		is_allowed_path = any(request.build_absolute_uri(url) in referer for url in allowed_referers)
		
		if device_detail_url != current_url or not is_allowed_path:
			del request.session[session_key]
			
	source_info = request.session.get(session_key, {})
		
	return render(request, "pao/device_detail.html", {
		"doe":doe,
		"ivl_data": doe.ivl_set.all(),
		"lt_data": doe.lt_set.all(),
		"cv_data": doe.cv_set.all() if doe.product_type == "PO" else None,
		"iv_data": doe.iv_set.all() if doe.product_type == "PO" else None,
		"angle_data": doe.angle_set.all() if doe.product_type == "TV" else None,
		"layouts": json.dumps(default_layout()),
		"source_info": source_info
	})

@login_required_hx
def compare_po(request, profile_id):
	tag, doe_result = get_selected_doe(request, prefetch_fields=["ivl_set", "lt_set", "cv_set", "iv_Set"])
	match tag:
		case "warning":
			getattr(messages, tag)(request, doe_result)
			return redirect(reverse_lazy("pao:device_list") + f"?profile_id={profile_id}")
		case "success":
			profile = get_object_or_404(AnalysisProfile, id=profile_id)
			try:
				profile_permission = AnalysisProfilePermission.objects.get(
					profile_id=profile_id, user_id=request.user.id)
			except AnalysisProfilePermission.DoesNotExist:
				return redirect(reverse_lazy("pao:analysis-profiles"))
				
			permission_level = profile_permission.permission_level
			po_additions = getattr(profile, "po_additions", None)

			fitting_form = FittingForm()
			fitting_form.helper.attrs = {
				"action": f"{reverse_lazy('pao:convert_efficienty_po')"
			}
			
			if request.user.is_staff:
				productspec = ProductSpec.objects.all()
			else:
				productspec = ProductSpec.objects.filter(
					Q(created_user_id=request.user.id) | Q(created_user__in=request.user.follower_user_set.all()))
					
			label_qs = productspec.values_list("label", flat=True).distinct()
			label_choices = [(label, label) for label in label_qs]
			fitting_form.fields["label"].choices = label_choices
			
			try:
				if po_additions and po_additions.productspec:
					first_product = po_additions.productspec
				else:
					first_product = productspec.latest("-pk")
					
				for k in fitting_form.fields.keys():
					fitting_form.fields[k].initial = getattrs(first_product, k)
					
			except ProductSpec.DoesNotExist:
				messages.warning(request, "등록된 스펙이 없습니다")
				
			if hasattr(profile, "po_additions"):
				layouts = json.dumps(profile.po_additions.layout)
				url_ids = set([int(id) for id in request.GET.get("ids").split(",")])
				profile_ids = set(profile.doe.values_list("id", flat=True))
				doe_changed = (url_ids - profile_ids) | (profile_ids - url_ids)
				vjl_table = (json.dumps(profile.po_additions.vjl_table) ir not doe_changed else [])
			else:
				layouts = json.dumps(default_layout())
				vjl_table = []
				
			context = {
				"selected_does": doe_result,
				"form": fitting_form,
				"profile": profile,
				"profileLayouts": layouts,
				"profileVJLTableData": vjl_table,
				"permission_level": permission_level
			}
			return render(request, "pao/compare_po.html", context)
			
@login_required_hx
@require_http_methods(["GET"])
def get_graph_for_selected_ivl(request):
	ivl_ids_param = request.Get.get("ids", "")
	if not ivl_ids_param:
		return JsonResponse({"tag": "warning", "message": "ivl데이터가 없습니다"})
		
	ivl_ids = ivl_ids_param.split(",")
	
	vjl_list = []
	# cj, el
	
	ivl_plotly_processor = IVLPlotlyProcessor()
	check_perm = permission_closure(request)
	unauthorized_list = []
	for ivl_idx, ivl_id in enumerate(ivl_ids):
		ivl_expt = IVL.objects.get(id=ivl_id)
		if not check_perm(ivl_expt):
			unauthorized_list.append(ivl_id)
			continue
		
		ivl_processed = process_ivl(ivl_expt)
		
		ivl_plotly_processor.ivl_processed = ivl_processed
		ivl_plotly_processor.index = ivl_idx
		
		vjl_list.extend(ivl_plotly_processor.get_ivl())
		#cj, el
		
	if unauthorized_list:
		return JsonResponse({"tag": "error", "message": f"permission denied: {unauthorized_list}")
		
	chart_response = {
		"tag": "success", "vjl_data": vjl_list, "cj_data": cj_list, "el_data": el_list
	}
	
	return JsonResponse(chart_response)