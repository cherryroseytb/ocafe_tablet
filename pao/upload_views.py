@login_required_hx
def upload_ivlfiles(request):
    product_type = request.POST.get("product_type")
    print("product_type in upload_ivelfiles at views:", product_type)
    return upload_files(request, IVL, upload_ivl_to_dataframe, assign_ivl, "ivlDate", product_type)


def upload_files(request, model_class, upload_to_dataframe_func, assign_func, datekey, product_type):
    if request,method == "POST":
        experiement_date = request.POST.get(datekey)
        print("RAW DATA:", dict(request.POST))