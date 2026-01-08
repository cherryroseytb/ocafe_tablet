function deleteTable(event) {
  const table = event.target.closest(".table-responsive");
  if (table) table.remove();
}
