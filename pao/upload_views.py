@login_required_hx
def upload_ivlfiles(request):
    product_type = request.POST.get("product_type")
    print("product_type in upload_ivelfiles at views:", product_type)
    return upload_files(request, IVL, upload_ivl_to_dataframe, assign_ivl, "ivlDate", product_type)


def upload_files(request, model_class, upload_to_dataframe_func, assign_func, datekey, product_type):
    if request,method == "POST":
        experiement_date = request.POST.get(datekey)
        print("RAW DATA:", dict(request.POST))

@login_required_hx
def delete_for_detail(request, model_class, doe_id, model_is, model_name):
    if request.method == "POST":
        obj = get_object_or_404(
            model_class, doe_id=doe_id, **{f"{model_name.lower()}_id": model_id}
        )
        if obj.created_user != request.user:
            messages.error(request, "본인이 업로드한 파일만 삭제 가능합니다.")
        else:
            obj.delete()
            messages.success(request, f"{model_id}가 삭제되었습니다.")

            # ✨ Session에서 source_info 복원
            session_key_raw = f"device_detail_{doe_id}_{request.user.id}"
            session_key = hashlib.sha256(session_key_raw.encode()).hexdigest()
            source_info = request.session.get(session_key, {})
            
            # ✨ TV Compare에서 왔으면 파라미터 유지하며 리다이렉트
            if source_info.get('from') == 'compare_tv' and source_info.get('profile_id'):
                redirect_url = reverse('pao:device_detail', kwargs={'pk': doe_id})
                params = f"?from={source_info['from']}&profile_id={source_info['profile_id']}&ids={source_info['ids']}"
                return redirect(redirect_url + params)
            

            return redirect("pao:device_detail", pk=doe_id)
    else:
        messages.error(request, "잘못된 요청입니다.")

@login_required_hs
def ivl_delete_for_detail(request, doe_id, ivl_id):
    return delete_for_detail(request, IVL, doe_id, ivl_id, "IVL")


class DeviceEditView(View, LoginRequiredMixin):
    template_name = "pao/device_edit.html"

    def get(self, request, pk):
        doe = get_object_or_404(DOE, pk=pk)
        if (doe.created_user == request.user) or (request.user.is_superuser):
            form = DeviceEditForm(instance=doe)
            constext = {
                "pk": pk,
                "doe": form,
                "edit": "수정하기"
            }
            return render(request, self,tamplate_name, context)
        else:
            messages.error(request, "해당 소자에 대한 편집 권한이 없습니다.")
            return redirect(reverse_lazy("pao:device_detail", args=[pk]))
    
    def post(self, request, pk):
        doe = get_object_or_404(DOE, pk=pk)
        if (doe.created_user == request.user) or (request.user.is_superuser):
            form = DeviceEditForm(request.POST, instance=doe)

            if not form.changed_data:
                messages.info(request, "변경된 사항이 없습니다.")
                return redirect(reverse_lazy("pao:device_detail", arg=[pk]))

            if form.is_valid():
                try:
                    doe - form.save(commit=False)
                    doe.save()
                except UniqueViolation:
                    messages.error(request, "같은 order의 layer와 thickness를 확인해주세요.")
                except Exception as e:
                    messages.error(request, f"{e}")
                messages.success(request, "수정되었습니다.")
            else:
                messages.error(request, "incalid form")
            return redirect(reverse_lazy("pao:device_detail", args=[pk]))
        else:
            messages.error(request, "해당 소자에 대한 편집 권한이 없습니다.")
            return redirect(reverse_lazy("pao:device_detail", args=[pk]))








알겠습니다! 이해했습니다.

**문제:** `compare_tv`에서 왔을 때만 URL 파라미터를 유지해야 함

## 수정이 필요한 부분들:

### 1. DeviceEditView (수정/저장 시)

```python
def post(self, request, pk):
    doe = get_object_or_404(DOE, pk=pk)
    if (doe.created_user == request.user) or (request.user.is_superuser):
        form = DeviceEditForm(request.POST, instance=doe)

        if not form.changed_data:
            messages.info(request, "변경된 사항이 없습니다.")
            # ✨ Session 복원 추가
            redirect_url = self.get_redirect_url(request, pk)
            return redirect(redirect_url)

        if form.is_valid():
            try:
                doe = form.save(commit=False)
                doe.save()
                
                # ✨ SessionStorage에 변경사항 저장 (선택사항)
                # JavaScript에서 처리할 예정
                
            except UniqueViolation:
                messages.error(request, "같은 order의 layer와 thickness를 확인해주세요.")
            except Exception as e:
                messages.error(request, f"{e}")
            messages.success(request, "수정되었습니다.")
        else:
            messages.error(request, "invalid form")
        
        # ✨ Session 복원 추가
        redirect_url = self.get_redirect_url(request, pk)
        return redirect(redirect_url)
    else:
        messages.error(request, "해당 소자에 대한 편집 권한이 없습니다.")
        redirect_url = self.get_redirect_url(request, pk)
        return redirect(redirect_url)
    
# ✨ Helper 메서드 추가
def get_redirect_url(self, request, pk):
    import hashlib
    from django.urls import reverse
    
    session_key_raw = f"device_detail_{pk}_{request.user.id}"
    session_key = hashlib.sha256(session_key_raw.encode()).hexdigest()
    source_info = request.session.get(session_key, {})
    
    if source_info.get('from') == 'compare_tv' and source_info.get('profile_id'):
        redirect_url = reverse('pao:device_detail', kwargs={'pk': pk})
        params = f"?from={source_info['from']}&profile_id={source_info['profile_id']}&ids={source_info['ids']}"
        return redirect_url + params
    
    return reverse('pao:device_detail', kwargs={'pk': pk})
```

### 2. DOE 삭제 View는 어디 있나요?

`device_delete` 또는 `doe_delete` 같은 View나 URL 패턴을 보여주시면 그것도 수정해드리겠습니다.

**질문:**
- DOE 삭제는 어떤 View에서 처리하나요?
- urls.py에서 삭제 관련 URL 패턴을 보여주실 수 있나요?