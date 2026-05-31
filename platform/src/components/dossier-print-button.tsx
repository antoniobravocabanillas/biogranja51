"use client";

export function DossierPrintButton() {
  return (
    <button className="dossier-print-button" onClick={() => window.print()} type="button">
      Imprimir / exportar PDF
    </button>
  );
}
