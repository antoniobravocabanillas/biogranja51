// comprobantes.js — versión simplificada con encabezado bajo el logo (BioGranja51)
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const infoSection = document.getElementById("info");
  const comprobanteData = document.getElementById("comprobanteData");
  const btnPDF = document.getElementById("btnPDF");
  let pdfData = null;

  // Función utilitaria para obtener valores XML sin importar namespace
  const getTagValue = (xmlDoc, tagName, context = xmlDoc) => {
    try {
      const el = context.getElementsByTagNameNS("*", tagName);
      return el.length > 0 ? el[0].textContent.trim() : "—";
    } catch {
      return "—";
    }
  };

  // === Procesar XML cargado ===
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const xmlDoc = new DOMParser().parseFromString(evt.target.result, "text/xml");

        // Tipo de documento
        const tipoDocCode = getTagValue(xmlDoc, "InvoiceTypeCode");
        let tipoDoc = "Comprobante Electrónico";
        if (tipoDocCode === "01") tipoDoc = "Factura Electrónica";
        else if (tipoDocCode === "03") tipoDoc = "Boleta de Venta Electrónica";

        const serieNumero = getTagValue(xmlDoc, "ID");
        const fecha = getTagValue(xmlDoc, "IssueDate");

        // Emisor
        let rucEmisor = "—", razonSocial = "—";
        const supplier = xmlDoc.getElementsByTagNameNS("*", "AccountingSupplierParty")[0];
        if (supplier) {
          const party = supplier.getElementsByTagNameNS("*", "Party")[0];
          if (party) {
            const idNode = party.getElementsByTagNameNS("*", "ID")[0];
            if (idNode) rucEmisor = idNode.textContent.trim();
            const nameNode = party.getElementsByTagNameNS("*", "RegistrationName")[0];
            if (nameNode) razonSocial = nameNode.textContent.trim();
          }
        }

        // Cliente
        let cliente = "—", rucCliente = "—";
        const customer = xmlDoc.getElementsByTagNameNS("*", "AccountingCustomerParty")[0];
        if (customer) {
          const party = customer.getElementsByTagNameNS("*", "Party")[0];
          if (party) {
            const idNode = party.getElementsByTagNameNS("*", "ID")[0];
            if (idNode) rucCliente = idNode.textContent.trim();
            const nameNode = party.getElementsByTagNameNS("*", "RegistrationName")[0];
            if (nameNode) cliente = nameNode.textContent.trim();
          }
        }

        // Totales
        const opGravada = getTagValue(xmlDoc, "TaxableAmount");
        const igv = getTagValue(xmlDoc, "TaxAmount");
        const total = getTagValue(xmlDoc, "PayableAmount");
        const montoEnLetras = getTagValue(xmlDoc, "Note");

        // Afectación IGV
        let afectacionTexto = "—";
        const taxNodes = xmlDoc.getElementsByTagNameNS("*", "TaxCategory");
        let afectacionCodigo = taxNodes.length > 0
          ? taxNodes[0].getElementsByTagNameNS("*", "ID")[0]?.textContent.trim()
          : "—";
        switch (afectacionCodigo) {
          case "10": afectacionTexto = "Gravado - Operación Onerosa"; break;
          case "20":
          case "9997": afectacionTexto = "Exonerado del IGV"; break;
          case "30":
          case "9998": afectacionTexto = "Inafecto al IGV"; break;
          case "40": afectacionTexto = "Exportación"; break;
          default: afectacionTexto = "Sin afectación definida";
        }

        // Items
        const items = xmlDoc.getElementsByTagNameNS("*", "InvoiceLine");
        const itemsData = [];
        let detallesHTML = `
          <h3>Detalle de Productos</h3>
          <table>
            <tr><th>#</th><th>Descripción</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr>`;
        for (let i = 0; i < items.length; i++) {
          const desc = getTagValue(xmlDoc, "Description", items[i]);
          const qty = getTagValue(xmlDoc, "InvoicedQuantity", items[i]);
          const price = getTagValue(xmlDoc, "PriceAmount", items[i]);
          const lineTotal = getTagValue(xmlDoc, "LineExtensionAmount", items[i]);
          itemsData.push({ desc, qty, price, lineTotal });
          detallesHTML += `
            <tr><td>${i + 1}</td><td>${desc}</td><td>${qty}</td><td>${price}</td><td>${lineTotal}</td></tr>`;
        }
        detallesHTML += "</table>";

        comprobanteData.innerHTML = `
          <p><strong>${tipoDoc}</strong></p>
          <p><strong>Serie y Número:</strong> ${serieNumero}</p>
          <p><strong>Fecha:</strong> ${fecha}</p>
          <p><strong>Emisor:</strong> ${razonSocial} (RUC ${rucEmisor})</p>
          <p><strong>Cliente:</strong> ${cliente} — ${rucCliente}</p>
          <p><strong>Afectación IGV:</strong> ${afectacionTexto}</p>
          <p><strong>Total Venta:</strong> S/ ${total}</p>
          ${detallesHTML}
        `;
        infoSection.classList.remove("hidden");

        pdfData = {
          tipoDoc, tipoDocCode, serieNumero, fecha,
          rucEmisor, razonSocial, cliente, rucCliente,
          afectacionTexto, opGravada, igv, total, montoEnLetras, items: itemsData,
        };
      } catch (err) {
        console.error("Error procesando XML:", err);
        alert("Error al procesar el XML. Revisa consola (F12).");
      }
    };
    reader.readAsText(file);
  });

  // === Generar PDF ===
  btnPDF.addEventListener("click", async () => {
    if (!pdfData) return alert("Primero carga un comprobante XML válido.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- LOGO ---
    const logoPath = "assets/logos/bg51.png";
    const logo = new Image();
    logo.crossOrigin = "anonymous";
    const loadLogo = new Promise((resolve) => {
      logo.onload = resolve;
      logo.onerror = resolve;
      logo.src = logoPath;
    });
    await loadLogo;

    // --- Insertar logo y texto debajo ---
    let baseY = 20;
    try {
      if (logo.complete && logo.naturalWidth > 0) {
        const maxHeight = 25;
        const ratio = logo.naturalWidth / logo.naturalHeight;
        const width = maxHeight * ratio;
        doc.addImage(logo, "PNG", 15, 15, width, maxHeight);
        baseY = 15 + maxHeight + 6;
      }
    } catch (err) {
      console.warn("Logo no cargado correctamente:", err);
    }

    // --- Texto debajo del logo ---
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    const infoX = 15;
    let y = baseY;
    doc.text("www.biogranja51.com | Cel: 936 198 468", infoX, y);
    y += 6;
    doc.text(`RUC: ${pdfData.rucEmisor}`, infoX, y);
    y += 6;
    doc.text(`${pdfData.tipoDoc} — ${pdfData.serieNumero}`, infoX, y);
    y += 6;
    doc.text(`Fecha: ${pdfData.fecha}`, infoX, y);
    y += 6;
    doc.text(`${pdfData.afectacionTexto}`, infoX, y);
    y += 10;

    // === CLIENTE ===
    doc.setFontSize(9);
    doc.text(`Cliente: ${pdfData.cliente}`, infoX, y);
    y += 6;
    doc.text(`RUC/DNI: ${pdfData.rucCliente}`, infoX, y);
    y += 8;

    // === TABLA ===
    doc.setFillColor(0, 188, 212);
    doc.rect(15, y - 6, 180, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("Descripción", 18, y);
    doc.text("Cant.", 100, y);
    doc.text("Precio", 130, y);
    doc.text("Total", 165, y);
    doc.setTextColor(0, 0, 0);
    y += 6;

    pdfData.items.forEach((it) => {
      doc.text(String(it.desc).substring(0, 60), 18, y);
      doc.text(String(it.qty), 100, y);
      doc.text(String(it.price), 130, y);
      doc.text(String(it.lineTotal), 165, y);
      y += 6;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    });

    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: S/ ${pdfData.total}`, 15, y);
    y += 6;
    if (pdfData.montoEnLetras && pdfData.montoEnLetras !== "—") {
      doc.setFont("helvetica", "normal");
      doc.text(`SON: ${pdfData.montoEnLetras}`, 15, y);
      y += 10;
    }

    // === CUENTAS ===
    doc.setDrawColor(76, 175, 80);
    doc.setFillColor(255, 250, 205);
    const boxH = 40;
    doc.roundedRect(15, y, 130, boxH, 3, 3, "FD");
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text("💰 Cuentas Bancarias:", 18, y + 8);
    doc.text("BCP - Cuenta: 5707-30139806-8", 18, y + 16);
    doc.text("CCI: 002-57000-730139-806802", 18, y + 24);
    doc.text("Yape: 936 198 468", 18, y + 32);

    // === QR YAPE ===
    try {
      const qrUrl = "https://chart.googleapis.com/chart?chs=120x120&cht=qr&chl=936198468";
      const qrImg = new Image();
      const qrLoaded = new Promise((resolve) => {
        qrImg.onload = resolve;
        qrImg.onerror = resolve;
        qrImg.src = qrUrl;
      });
      await qrLoaded;
      if (qrImg.complete && qrImg.naturalWidth > 0) {
        doc.addImage(qrImg, "PNG", 155, y, 40, 40);
      }
    } catch (err) {
      console.warn("Error cargando QR:", err);
    }

    // === PIE ===
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Gracias por su preferencia - www.biogranja51.com", 105, y + 55, { align: "center" });

    // === GUARDAR ===
    doc.save(`Comprobante_${pdfData.serieNumero || "sin-numero"}.pdf`);
  });
});
