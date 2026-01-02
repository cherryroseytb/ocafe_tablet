import os
import re
from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from dvmt.models import ManualFile

# 단일 manual 디렉토리 기준
manual_path = os.path.join(settings.MEDIA_ROOT, "dvmt", "manual")
manual_storage_prefix = "dvmt/manual"

def extract_base_name(filename):
    base = os.path.splitext(filename)[0]
    return re.sub(r'[\-_]?v\d+(\.\d+)?$', '', base, flags=re.IGNORECASE).strip()

def extract_version(filename):
    base = os.path.splitext(filename)[0]
    match = re.search(r'[\-_]?v?(\d+(?:\.\d+)?)[vV]?$', base)
    return float(match.group(1)) if match else 0.0

class Command(BaseCommand):
    help = "Manage ManualFile DB entries using manual/ folder directly. Only latest versions kept."

    def add_arguments(self, parser):
        parser.add_argument("--fpath", "-f", type=str, default=manual_path)

    def handle(self, *args, **kwargs):
        fpath = kwargs["fpath"]

        if not os.path.exists(fpath):
            self.stdout.write(self.style.ERROR(f"Directory not found: {fpath}"))
            return

        manual_files = ManualFile.objects.all()
        db_file_dict = {}

        for obj in manual_files:
            base = extract_base_name(obj.title)
            version = extract_version(obj.title)
            if base not in db_file_dict or db_file_dict[base][1] < version:
                db_file_dict[base] = (obj, version)

        for filename in sorted(os.listdir(fpath)):
            if not filename.endswith((".ppt", ".pptx")):
                continue

            file_path = os.path.join(fpath, filename)
            with open(file_path, "rb") as f:
                file_content = f.read()

            base_name = extract_base_name(filename)
            new_version = extract_version(filename)
            storage_path = os.path.join(manual_storage_prefix, filename)

            existing_entry = db_file_dict.get(base_name)

            if existing_entry:
                existing, existing_version = existing_entry
                if new_version > existing_version:
                    if existing.file and default_storage.exists(existing.file.name):
                        default_storage.delete(existing.file.name)

                    default_storage.save(storage_path, ContentFile(file_content))
                    existing.file.name = storage_path
                    existing.title = filename
                    existing.save()

                    db_file_dict[base_name] = (existing, new_version)
                    self.stdout.write(self.style.SUCCESS(
                        f"Updated: {filename} (v{existing_version} → v{new_version})"))
                else:
                    self.stdout.write(self.style.WARNING(
                        f"Skipped: {filename} is older or same version (existing v{existing_version})"))
            else:
                default_storage.save(storage_path, ContentFile(file_content))

                manual_file = ManualFile()
                manual_file.file.name = storage_path
                manual_file.title = filename
                manual_file.save()

                db_file_dict[base_name] = (manual_file, new_version)
                self.stdout.write(self.style.SUCCESS(f"Added new: {filename}"))

        # [Optional] remove stray files not linked to DB
        all_db_filenames = set(os.path.basename(obj.file.name) for obj in ManualFile.objects.all())
        for filename in os.listdir(fpath):
            if filename.endswith((".ppt", ".pptx")) and filename not in all_db_filenames:
                full_path = os.path.join(fpath, filename)
                os.remove(full_path)
                self.stdout.write(self.style.WARNING(f"Removed stale file: {filename} (not in DB)"))

        self.stdout.write(self.style.SUCCESS("ManualFile update complete. Only latest files kept in manual/ directory."))
