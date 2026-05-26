"use client";

type Props = {
  isAdminMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export default function BookingActionsIdle({
  isAdminMode,
  onEdit,
  onCancel,
  onDelete,
}: Props) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
      {isAdminMode && (
        <div className="text-xs text-purple-700 bg-purple-50 border border-purple-100 p-2 rounded-lg flex items-center gap-2">
          <span>🛡️</span>
          <span>
            <strong>Mode admin actif</strong> · aucun email ne sera envoyé
          </span>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onEdit}
          className="flex-1 min-w-[120px] rounded-lg border border-slate-300 py-2 text-sm font-medium hover:bg-slate-50"
        >
          ✏️ Modifier les dates
        </button>
        <button
          onClick={onCancel}
          className="flex-1 min-w-[120px] rounded-lg border border-red-300 text-red-700 py-2 text-sm font-medium hover:bg-red-50"
        >
          🚫 Annuler
        </button>
        {isAdminMode && (
          <button
            onClick={onDelete}
            className="flex-1 min-w-[120px] rounded-lg border border-red-500 bg-red-50 text-red-800 py-2 text-sm font-medium hover:bg-red-100"
          >
            🗑️ Supprimer
          </button>
        )}
      </div>
    </div>
  );
}