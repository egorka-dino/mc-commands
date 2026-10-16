export function PreviewLoading({ updating = false }: { updating?: boolean }) {
  return <div className="preview-loading" role="status">
    <span className="preview-spinner" aria-hidden="true" />
    <strong>{updating ? "Обновляем предпросмотр…" : "Загружаем предпросмотр…"}</strong>
    <span>Подготавливаем модель и текстуры</span>
  </div>;
}
