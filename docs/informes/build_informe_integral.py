from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = Path(__file__).resolve().parent
DOCX_PATH = OUTPUT_DIR / "Informe_Integral_BioGranja51_Marketing_Desarrollo.docx"
LOGO = ROOT / "img" / "Recurso 19.png"
SCREEN_ADMIN = Path(
    "C:/Users/Binv/AppData/Local/Temp/biogranja51-preview/gestion-productos.png"
)
SCREEN_QUOTE = Path(
    "C:/Users/Binv/AppData/Local/Temp/biogranja51-preview/cotizador-total.png"
)

FOREST = "164B36"
LEAF = "4B9655"
MINT = "E7F0E4"
CREAM = "F7F3EB"
GOLD = "B69356"
INK = "26332C"
MUTED = "667269"
LINE = "D8D8CE"
WARNING = "FFF2DF"
COOL = "EDF2F1"


def font(run, size=None, color=None, bold=None, name="Aptos"):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.rFonts
    rfonts.set(qn("w:ascii"), name)
    rfonts.set(qn("w:hAnsi"), name)
    if size:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if bold is not None:
        run.bold = bold
    return run


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def cell_margin(cell, top=110, start=130, bottom=110, end=130):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def borders(cell, color=LINE, size="4"):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = tc_pr.first_child_found_in("w:tcBorders")
    if tc_borders is None:
        tc_borders = OxmlElement("w:tcBorders")
        tc_pr.append(tc_borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        elem = tc_borders.find(qn(tag))
        if elem is None:
            elem = OxmlElement(tag)
            tc_borders.append(elem)
        elem.set(qn("w:val"), "single")
        elem.set(qn("w:sz"), size)
        elem.set(qn("w:space"), "0")
        elem.set(qn("w:color"), color)


def no_row_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:cantSplit"))


def paragraph(doc, text="", style=None, color=INK, size=10, bold=False, space_after=6):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.15
    if text:
        font(p.add_run(text), size=size, color=color, bold=bold)
    return p


def label(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.keep_with_next = True
    run = font(p.add_run(text.upper()), size=8.5, color=LEAF, bold=True)
    run.font.letter_spacing = Pt(1.2)
    return p


def heading(doc, text, level=1, number=None, subtitle=None):
    if number:
        label(doc, f"{number} / INFORME INTEGRAL")
    p = doc.add_paragraph()
    p.style = f"Heading {level}"
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    font(
        p.add_run(text),
        size=25 if level == 1 else 16,
        color=FOREST,
        bold=True,
        name="Aptos Display",
    )
    if subtitle:
        paragraph(doc, subtitle, color=MUTED, size=10.2, space_after=14)
    return p


def bullet(doc, text, color=INK):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.1
    font(p.add_run(text), size=9.5, color=color)
    return p


def table(doc, headers, rows, widths=None, header_fill=FOREST, text_size=8.7):
    tbl = doc.add_table(rows=1, cols=len(headers))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    for index, header in enumerate(headers):
        cell = tbl.rows[0].cells[index]
        if widths:
            cell.width = Cm(widths[index])
        shade(cell, header_fill)
        borders(cell, color=header_fill)
        cell_margin(cell, top=130, bottom=130)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        font(p.add_run(header), size=text_size, color="FFFFFF", bold=True)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    no_row_split(tbl.rows[0])
    for row_data in rows:
        cells = tbl.add_row().cells
        no_row_split(tbl.rows[-1])
        for index, value in enumerate(row_data):
            cell = cells[index]
            if widths:
                cell.width = Cm(widths[index])
            shade(cell, "FFFFFF")
            borders(cell)
            cell_margin(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.1
            font(p.add_run(str(value)), size=text_size, color=INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return tbl


def metric_row(doc, metrics):
    tbl = doc.add_table(rows=1, cols=len(metrics))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    for i, (value, caption) in enumerate(metrics):
        cell = tbl.rows[0].cells[i]
        cell.width = Cm(5.45)
        shade(cell, MINT)
        borders(cell, color=MINT)
        cell_margin(cell, top=200, bottom=180, start=180, end=180)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(3)
        font(p.add_run(value), size=21, color=FOREST, bold=True, name="Aptos Display")
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        font(p.add_run(caption), size=8.7, color=MUTED, bold=True)
    paragraph(doc, "", space_after=4)


def callout(doc, title, body, fill=MINT, title_color=FOREST, body_color=INK):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    shade(cell, fill)
    borders(cell, color=fill)
    cell_margin(cell, top=170, bottom=170, start=190, end=190)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(5)
    font(p.add_run(title.upper()), size=8.3, color=title_color, bold=True)
    p = cell.add_paragraph()
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.12
    font(p.add_run(body), size=9.4, color=body_color)
    paragraph(doc, "", space_after=4)


def two_column_cards(doc, cards):
    tbl = doc.add_table(rows=0, cols=2)
    tbl.autofit = False
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    for start in range(0, len(cards), 2):
        cells = tbl.add_row().cells
        for col in range(2):
            if start + col >= len(cards):
                shade(cells[col], "FFFFFF")
                borders(cells[col], color="FFFFFF")
                continue
            title, content = cards[start + col]
            cell = cells[col]
            cell.width = Cm(8.2)
            shade(cell, CREAM)
            borders(cell, color=LINE)
            cell_margin(cell, top=160, bottom=160, start=170, end=170)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(5)
            font(p.add_run(title), size=10, color=FOREST, bold=True)
            p = cell.add_paragraph()
            p.paragraph_format.line_spacing = 1.12
            p.paragraph_format.space_after = Pt(0)
            font(p.add_run(content), size=8.8, color=INK)
        no_row_split(tbl.rows[-1])
    paragraph(doc, "", space_after=3)


def caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(10)
    font(p.add_run(text), size=8.2, color=MUTED)


def page_break(doc):
    doc.add_page_break()


def configure_document(doc):
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.7)
    section.bottom_margin = Cm(1.45)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)
    section.header_distance = Cm(0.8)
    section.footer_distance = Cm(0.7)

    normal = doc.styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(10)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.15

    for style_name, size in (("Heading 1", 25), ("Heading 2", 16), ("Heading 3", 12)):
        style = doc.styles[style_name]
        style.font.name = "Aptos Display"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(FOREST)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.space_before = Pt(8)
        style.paragraph_format.space_after = Pt(6)

    bullet_style = doc.styles["List Bullet"]
    bullet_style.font.name = "Aptos"
    bullet_style.font.size = Pt(9.5)
    bullet_style.paragraph_format.left_indent = Cm(0.55)
    bullet_style.paragraph_format.first_line_indent = Cm(-0.25)

    header = section.header
    p = header.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    font(p.add_run("BIOGRANJA 51  |  PLAN MAESTRO 2026"), size=7.5, color=LEAF, bold=True)
    line = p._p.get_or_add_pPr()
    border = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")
    bottom.set(qn("w:space"), "6")
    bottom.set(qn("w:color"), MINT)
    border.append(bottom)
    line.append(border)

    footer = section.footer
    tbl = footer.add_table(rows=1, cols=3, width=Cm(17))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cells = tbl.rows[0].cells
    for cell in cells:
        borders(cell, color="FFFFFF", size="0")
    p = cells[0].paragraphs[0]
    font(p.add_run("Informe integral"), size=7.5, color=MUTED)
    p = cells[1].paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    font(p.add_run("Marketing + Desarrollo + Operación"), size=7.5, color=MUTED)
    p = cells[2].paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    font(p.add_run("Página "), size=7.5, color=MUTED)
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    p._p.append(field)


def build_document():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = Document()
    configure_document(doc)

    # Cover
    paragraph(doc, "", space_after=14)
    if LOGO.exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.add_run().add_picture(str(LOGO), width=Inches(2.9))
    paragraph(doc, "", space_after=42)
    label(doc, "INFORME INTEGRAL / MAYO 2026")
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(12)
    font(p.add_run("BioGranja 51"), size=39, color=FOREST, bold=True, name="Aptos Display")
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(12)
    p.paragraph_format.line_spacing = 1.05
    font(
        p.add_run("Visión unificada de marca,\nplataforma y operación 360"),
        size=24,
        color=LEAF,
        bold=True,
        name="Aptos Display",
    )
    paragraph(
        doc,
        "Documento rector para construir una marca moderna de proteínas premium, basada en confianza alimentaria, conveniencia y trazabilidad verificable.",
        size=11.2,
        color=INK,
        space_after=28,
    )
    metric_row(
        doc,
        [
            ("5", "productos iniciales"),
            ("3", "zonas de entrega"),
            ("360°", "visión de empresa"),
        ],
    )
    paragraph(doc, "", space_after=34)
    paragraph(doc, "Preparado para: BioGranja 51", size=9, color=MUTED, bold=True)
    paragraph(doc, "Fecha de corte: 23 de mayo de 2026 | Trujillo, Perú", size=9, color=MUTED)
    paragraph(doc, "Estado: base funcional en desarrollo, pendiente de conexión productiva.", size=9, color=MUTED)
    page_break(doc)

    # Executive guide
    heading(
        doc,
        "Dirección ejecutiva",
        number="01",
        subtitle="Una visión única para dirección, marketing, desarrollo y operación.",
    )
    callout(
        doc,
        "Tesis central",
        "BioGranja 51 no debe competir como vendedor de pollo, huevos o carne. Debe convertirse en una marca moderna de alimentación confiable: conveniencia premium, origen verificable, experiencia impecable y una operación medida por datos.",
    )
    label(doc, "ESTADO ACTUAL")
    metric_row(
        doc,
        [
            ("1", "plataforma nueva"),
            ("5/5", "productos trazables"),
            ("0", "pedidos de prueba guardados"),
        ],
    )
    table(
        doc,
        ["Frente", "Ya construido", "Siguiente decisión"],
        [
            ["Comercio", "Catálogo, cotizador y pedido antes de WhatsApp.", "Precios finales, horarios y stock."],
            ["Gestión", "Editor de productos, imágenes, zonas y pagos.", "Usuarios reales y permisos."],
            ["Datos", "Migración Supabase con seguridad y auditoría.", "Crear ambiente productivo."],
            ["Marca", "Promesa basada en origen visible.", "Definir sistema premium y validar sellos."],
        ],
        widths=[3.1, 7.0, 6.1],
    )
    label(doc, "LECTURA RECOMENDADA")
    paragraph(
        doc,
        "Marketing debe liderar las secciones 02, 03, 05 a 09 y 16. Desarrollo debe trabajar con las secciones 10 a 15. Dirección y operación deben cerrar las decisiones de las secciones 17 a 19.",
        size=9.5,
        color=INK,
    )
    page_break(doc)

    # Premium positioning
    heading(
        doc,
        "Oportunidad de posicionamiento",
        number="02",
        subtitle="El cliente no carece de proteína: carece de confianza, tiempo y una experiencia digna de recompra.",
    )
    callout(
        doc,
        "Tesis de marca",
        "No vendemos carne. Vendemos confianza alimentaria.",
        fill=FOREST,
        title_color="FFFFFF",
        body_color="FFFFFF",
    )
    table(
        doc,
        ["Dolor del cliente", "Qué vive hoy", "Respuesta BioGranja 51"],
        [
            ["Desconfianza", "No conoce origen, fecha ni manejo del producto.", "Origen visible, lote y evidencia progresiva."],
            ["Compra incómoda", "Traslado, espera, peso incierto y delivery débil.", "Compra digital, entrega programada y comunicación clara."],
            ["Falta de tiempo", "Quiere comer mejor, pero no planifica cada semana.", "Packs y suscripción flexible cuando exista stock estable."],
            ["Mercado genérico", "Oferta centrada en descuento y kilo.", "Diseño, precisión, servicio y trazabilidad."],
        ],
        widths=[3.2, 6.1, 6.8],
        text_size=8.5,
    )
    label(doc, "AUDIENCIA PRIORITARIA")
    paragraph(
        doc,
        "Hogares urbanos, familias jóvenes, consumidores fitness y clientes de meal prep que valoran calidad, tiempo y transparencia, y están dispuestos a pagar por una experiencia superior. La cobertura se define por viabilidad logística, no por clasificación socioeconómica de barrios.",
        size=9.5,
        color=INK,
    )
    callout(
        doc,
        "Decisión competitiva",
        "No entrar en una guerra de precios. El precio debe sostener calidad, cadena de frío, empaque, entrega, datos y servicio.",
        fill=WARNING,
    )
    page_break(doc)

    # System brand
    heading(
        doc,
        "Una marca de sistema",
        number="03",
        subtitle="La diferenciación sostenible no vive en un producto aislado, sino en la experiencia completa.",
    )
    label(doc, "PROMESA DE VALOR")
    metric_row(
        doc,
        [
            ("01", "confianza operativa"),
            ("02", "conveniencia premium"),
            ("03", "origen verificable"),
        ],
    )
    two_column_cards(
        doc,
        [
            ("BioGranja Weekly Box", "Caja semanal o quincenal con proteína y huevos, personalizable, pausables y con entrega planificada."),
            ("Entrega BioGranja", "Empaque limpio, etiqueta de origen, control térmico y experiencia consistente de recepción."),
            ("QR de trazabilidad", "Lote, origen, fecha, proveedor o granja y recomendaciones, habilitado al contar con evidencia operativa."),
            ("BioGranja Intelligence", "Historial, preferencias y recompra para que el cliente organice su alimentación sin fricción."),
            ("Packs inteligentes", "Family, Fitness, Parrilla y Meal Prep como ofertas a probar con demanda y margen real."),
            ("Chef Mode / Smart Restock", "Recetas asociadas a packs y recomendaciones futuras basadas en compras consentidas."),
        ],
    )
    callout(
        doc,
        "La defensa del negocio",
        "Un competidor puede copiar un producto o un descuento. Es mucho más difícil copiar marca, datos, trazabilidad, recurrencia, logística y una operación integrada.",
        fill=MINT,
    )
    page_break(doc)

    # Model 360
    heading(
        doc,
        "Modelo de negocio 360",
        number="04",
        subtitle="Un negocio que inicia comercializando y construye control para producir más de su propia oferta.",
    )
    label(doc, "CADENA DE VALOR")
    table(
        doc,
        ["1. Insumos", "2. Molino", "3. Producción", "4. Venta", "5. Recompra"],
        [
            [
                "Compras y costo por lote",
                "Alimento propio y servicio futuro",
                "Pollo propio; expansión gradual",
                "Tienda, WhatsApp y B2B",
                "Suscripción y fidelidad",
            ]
        ],
        widths=[3.25, 3.25, 3.25, 3.25, 3.25],
        text_size=8.2,
    )
    label(doc, "LÍNEAS DE INGRESO")
    two_column_cards(
        doc,
        [
            ("Comercialización inmediata", "Venta de pollo, huevos, res, cerdo y cuy a hogares. Permite tracción y aprendizaje comercial."),
            ("Suscripciones", "Pedidos recurrentes semanales o quincenales con ruta planificada y mayor previsibilidad."),
            ("Clientes B2B", "Restaurantes, tiendas y negocios con precios por volumen, frecuencia y despacho acordado."),
            ("Molino", "Servicio de molienda e insumos propios: primero como ahorro y luego como línea comercial formalizada."),
            ("Producción propia futura", "Cerdo y otras proteínas cuando exista capacidad, sanidad, costos y trazabilidad."),
            ("Circularidad futura", "Compost u otros aprovechamientos, únicamente con procesos medibles y autorizados."),
        ],
    )
    callout(
        doc,
        "Regla de crecimiento",
        "Ninguna nueva línea debe lanzarse sin dueño operativo, costo unitario, evidencia de origen, control sanitario aplicable y capacidad del sistema para registrar su trazabilidad.",
        fill=WARNING,
    )
    page_break(doc)

    # Brand trust
    heading(
        doc,
        "Marca y promesa de confianza",
        number="05",
        subtitle="La confianza premium requiere comunicar procedencia y servicio sin exageración.",
    )
    table(
        doc,
        ["Sello de comunicación", "Qué significa", "Aplicación inicial", "Estado"],
        [
            ["Origen propio", "Producido y respaldado por BioGranja.", "Pollo entero.", "Confirmado"],
            ["Proveedor seleccionado", "Compra formal evaluada por la empresa.", "Res y cerdo.", "Confirmado"],
            ["Origen por confirmar", "Producto disponible sin afirmar procedencia.", "Huevos y cuy.", "Pendiente"],
            ["Molino BioGranja", "Alimento o molienda con fórmula registrada.", "Uso interno/servicio.", "Futuro"],
            ["Circular", "Aprovechamiento documentado de subproductos.", "Compost u otros.", "Futuro"],
        ],
        widths=[3.2, 5.0, 4.6, 3.0],
    )
    label(doc, "MENSAJES QUE SÍ SE PUEDEN USAR")
    bullet(doc, "Pollo criado en nuestra granja, con alimentación controlada por etapa.")
    bullet(doc, "Origen visible por producto y coordinación directa de entrega en Trujillo.")
    bullet(doc, "Res y cerdo seleccionados bajo control de proveedor y despacho.")
    label(doc, "MENSAJES QUE DEBEN ESPERAR EVIDENCIA")
    bullet(doc, "No afirmar que huevos o cuy son de producción propia hasta confirmarlo y registrar lotes.")
    bullet(doc, "No usar promesas de salud, nutrición superior o sostenibilidad total sin respaldo.")
    bullet(doc, "No comercializar alimento o productos transformados sin validación formal aplicable.")
    callout(
        doc,
        "Posicionamiento recomendado",
        "BioGranja 51: la nueva generación de alimentación confiable, con proteínas premium, origen claro y una experiencia diseñada para volver.",
        fill=MINT,
    )
    page_break(doc)

    # Catalog
    heading(
        doc,
        "Oferta comercial inicial",
        number="06",
        subtitle="El catálogo mínimo viable ya existe en el sistema; faltan precios, stock y validaciones de origen.",
    )
    table(
        doc,
        ["Producto", "Presentación", "Origen visible", "Precio actual", "Suscripción"],
        [
            ["Pollo entero", "Entero, precio por kg", "Origen propio", "Por definir", "Sí"],
            ["Huevos frescos", "Maple completo, 30 unidades", "Por confirmar", "Por definir", "Sí"],
            ["Res seleccionada", "Porción de 500 g", "Proveedor", "Por definir", "Sí"],
            ["Cerdo seleccionado", "Porción de 500 g", "Proveedor", "Por definir", "Sí"],
            ["Cuy entero", "Unidad entera", "Por confirmar", "S/ 35.00", "No inicial"],
        ],
        widths=[3.35, 5.0, 3.35, 2.7, 2.4],
    )
    label(doc, "DECISIONES COMERCIALES PRIORITARIAS")
    two_column_cards(
        doc,
        [
            ("Pricing", "Definir precio/kg de pollo, res y cerdo; precio/maple; margen mínimo y política de promociones."),
            ("Disponibilidad", "Establecer stock diario, reserva de productos y regla ante falta de inventario."),
            ("Packs", "Probar caja familiar, parrillera y recurrente sin mezclar orígenes en la comunicación."),
            ("Fotos y contenido", "Cargar imágenes reales por producto, guía de peso y condiciones de entrega."),
        ],
    )
    callout(
        doc,
        "No confundir precio con peso",
        "Pollo debe mostrarse con peso estimado y confirmación final; res y cerdo deben calcularse correctamente por su presentación de 500 g.",
        fill=WARNING,
    )
    page_break(doc)

    # Audience and marketing
    heading(
        doc,
        "Estrategia de marketing",
        number="07",
        subtitle="La marca debe mostrar sistema y confianza, no limitarse a fotografías genéricas de producto.",
    )
    table(
        doc,
        ["Segmento", "Necesidad", "Propuesta", "Canal inicial"],
        [
            ["Familias urbanas", "Seguridad y ahorro de tiempo.", "Weekly Box con entrega coordinada.", "Instagram + WhatsApp"],
            ["Fitness / meal prep", "Ordenar proteína semanal.", "Packs por objetivo y frecuencia.", "Contenido + CRM"],
            ["Parrilla/ocasiones", "Calidad y puntualidad.", "Combos y preventa de fin de semana.", "Meta Ads"],
            ["Restaurantes pequeños", "Abastecimiento constante.", "Lista B2B y despacho programado.", "Venta directa"],
            ["Productores locales", "Molienda o alimento.", "Servicio documentado futuro.", "Referidos/B2B"],
        ],
        widths=[3.1, 4.0, 5.3, 4.0],
    )
    label(doc, "PILARES DE CONTENIDO")
    two_column_cards(
        doc,
        [
            ("Origen verificable", "Mostrar qué produce BioGranja, qué selecciona y qué evidencia respalda cada sello."),
            ("Experiencia premium", "Empaque, entrega, frescura percibida, atención y el ritual de recibir el pedido."),
            ("Sistema en acción", "Lotes, control térmico, logística, molino y personas responsables."),
            ("Utilidad diaria", "Recetas, porciones, meal prep y packs sin afirmaciones no validadas."),
        ],
    )
    callout(
        doc,
        "Objetivo de marketing de lanzamiento",
        "Conseguir recompra y datos de demanda real, no solo alcance: cada campaña debe llevar al cliente desde la confianza percibida hasta un pedido registrado y una experiencia de entrega memorable.",
    )
    page_break(doc)

    # Funnel
    heading(
        doc,
        "Funnel y plan de lanzamiento",
        number="08",
        subtitle="Marketing genera intención; la plataforma captura datos; operación cumple la promesa.",
    )
    table(
        doc,
        ["Etapa", "Experiencia del cliente", "Activo de marketing", "Métrica"],
        [
            ["Descubrimiento", "Descubre una marca moderna y confiable.", "Sistema, origen y experiencia.", "Visitas calificadas"],
            ["Consideración", "Revisa origen, precio y reparto.", "Página, QR futuro y FAQs.", "Agregar al pedido"],
            ["Conversión", "Indica dirección y método de pago.", "Cotizador + WhatsApp.", "Pedido registrado"],
            ["Cumplimiento", "Recibe a tiempo y confirma pago.", "Mensajes operativos.", "Entrega completa"],
            ["Recompra", "Recibe recordatorio o Weekly Box.", "CRM y contenido útil.", "Recompra 30 días"],
        ],
        widths=[2.6, 5.0, 5.0, 3.7],
    )
    label(doc, "PLAN DE 30 DÍAS DE ACTIVACIÓN")
    table(
        doc,
        ["Semana", "Marketing", "Desarrollo / operación"],
        [
            ["1", "Tono premium, fotos reales y promesa.", "Cerrar precios, zonas y horarios."],
            ["2", "Contenido de origen y experiencia.", "Conectar datos productivos y usuarios."],
            ["3", "Campaña piloto con entrega BioGranja.", "Registrar pedidos, stock y despacho."],
            ["4", "Retargeting y primera recompra.", "Medir margen, entrega y conversión."],
        ],
        widths=[1.5, 7.3, 8.5],
    )
    callout(
        doc,
        "Campañas responsables",
        "No segmentar ni comunicar zonas por nivel socioeconómico. Definir cobertura por logística, capacidad de entrega y costo de servicio.",
        fill=WARNING,
    )
    page_break(doc)

    # Commerce operation
    heading(
        doc,
        "Venta, delivery y pagos",
        number="09",
        subtitle="La entrega es parte del producto: pedido interno primero, coordinación precisa y experiencia consistente después.",
    )
    label(doc, "FLUJO DE PEDIDO")
    table(
        doc,
        ["Paso 1", "Paso 2", "Paso 3", "Paso 4", "Paso 5"],
        [
            [
                "Cliente elige producto",
                "Selecciona zona y dirección",
                "Elige Yape, Plin o transferencia",
                "Sistema registra pedido",
                "Ventas confirma por WhatsApp",
            ]
        ],
        widths=[3.25, 3.25, 3.25, 3.25, 3.25],
        text_size=8.1,
    )
    table(
        doc,
        ["Zona inicial", "Barrios referenciales", "Tarifa base", "Gratis desde"],
        [
            ["Trujillo urbano central", "Centro, San Andrés, La Merced, Primavera", "S/ 8", "S/ 160"],
            ["Víctor Larco y California", "California, El Golf, Las Flores, Buenos Aires", "S/ 10", "S/ 190"],
            ["Urbanizaciones norte y este", "Las Quintanas, Santa Inés, Los Cedros, Palermo", "S/ 10", "S/ 190"],
        ],
        widths=[4.0, 7.4, 2.6, 2.6],
    )
    label(doc, "EVOLUCIÓN REQUERIDA")
    bullet(doc, "Geocodificar dirección exacta y calcular ruta/tarifa final.")
    bullet(doc, "Agregar franjas horarias, capacidad diaria y retiro en tienda.")
    bullet(doc, "Diseñar empaque premium, etiqueta de origen y protocolo térmico verificable.")
    bullet(doc, "Conciliar comprobantes y luego integrar pasarela de pago.")
    bullet(doc, "Activar suscripción semanal/quincenal cuando haya stock y logística estable.")
    page_break(doc)

    # Built experience
    heading(
        doc,
        "Producto digital construido",
        number="10",
        subtitle="La plataforma es el inicio de la experiencia premium y el registro de confianza del cliente.",
    )
    table(
        doc,
        ["Superficie", "Capacidad disponible en desarrollo", "Preparación para escalar"],
        [
            ["Tienda", "Catálogo dinámico con sello de origen.", "Contenido premium y QR trazable."],
            ["Cotizador", "Carrito, dirección, delivery, pago y total.", "Tarifa exacta y delivery slots."],
            ["Pedido", "Número interno antes de abrir WhatsApp.", "Estados, cobro y despacho."],
            ["Gestión", "Productos, imágenes, zonas y pagos.", "Auth, roles, auditoría y evidencia."],
        ],
        widths=[2.7, 7.3, 6.1],
    )
    if SCREEN_QUOTE.exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(SCREEN_QUOTE), height=Inches(3.65))
        caption(doc, "Figura 1. Cotizador: cuy S/ 35 + entrega S/ 10 = total estimado S/ 45.")
    callout(
        doc,
        "Estado técnico",
        "La experiencia está validada localmente. Los datos usan persistencia JSON solo para desarrollo; los pedidos reales no deben operar allí.",
        fill=COOL,
    )
    page_break(doc)

    # Admin
    heading(
        doc,
        "Centro de gestión",
        number="11",
        subtitle="La operación necesita autonomía: editar catálogo y logística sin modificar código.",
    )
    if SCREEN_ADMIN.exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(SCREEN_ADMIN), height=Inches(4.5))
        caption(doc, "Figura 2. Panel de productos y precios, incluyendo sello de origen y publicación.")
    table(
        doc,
        ["Rol inicial", "Puede gestionar", "Control futuro necesario"],
        [
            ["Administrador", "Catálogo, precios, configuración, reportes.", "Autenticación y auditoría."],
            ["Ventas", "Clientes, pedidos, cobros, cotizaciones.", "Restricción por tienda."],
            ["Almacén / molino", "Inventario, lotes, insumos, despacho.", "Restricción por ubicación."],
        ],
        widths=[3.4, 7.0, 5.7],
    )
    page_break(doc)

    # Architecture
    heading(
        doc,
        "Arquitectura de desarrollo",
        number="12",
        subtitle="Recomendación: monolito modular para crecer rápido con una sola fuente transaccional.",
    )
    table(
        doc,
        ["Capa", "Tecnología propuesta / actual", "Propósito"],
        [
            ["Experiencia web", "Next.js 16 + TypeScript", "Tienda, gestión y futuro B2B."],
            ["Datos productivos", "PostgreSQL mediante Supabase", "Pedidos, lotes, stock, costos."],
            ["Identidad", "Supabase Auth + RLS", "Usuarios y permisos por rol/sede."],
            ["Archivos", "Supabase Storage", "Fotos, evidencias y comprobantes."],
            ["Pago inicial", "Yape, Plin y transferencia", "Confirmación controlada."],
            ["Analítica", "Eventos + dashboard operativo", "Conversión, recompra, margen y cumplimiento."],
            ["Despliegue", "Pruebas / producción separados", "Liberación segura."],
        ],
        widths=[3.1, 6.4, 6.6],
    )
    label(doc, "BARRERAS ANTES DE PRODUCCIÓN")
    two_column_cards(
        doc,
        [
            ("Autenticación", "Ningún editor administrativo expuesto sin sesión y permisos reales."),
            ("Persistencia", "Reemplazar JSON por base transaccional antes de tomar ventas."),
            ("Archivos", "Imágenes y comprobantes deben usar Storage con acceso controlado."),
            ("Auditoría", "Guardar cambios de precio, stock, pago y origen con responsable."),
        ],
    )
    page_break(doc)

    # Traceability
    heading(
        doc,
        "Datos, inventario y trazabilidad",
        number="13",
        subtitle="La ventaja competitiva aparece cuando cada venta puede explicar origen, costo y cumplimiento.",
    )
    label(doc, "FLUJO DE TRAZABILIDAD OBJETIVO")
    table(
        doc,
        ["Molino / proveedor", "Lote", "Inventario", "Pedido", "Cliente / indicador"],
        [
            [
                "Fórmula o compra formal",
                "Origen, fecha, costo, evidencia",
                "Ubicación, merma, frío",
                "Artículo y entrega",
                "Trazabilidad y margen",
            ]
        ],
        widths=[3.3, 3.5, 3.25, 3.1, 3.1],
        text_size=8.3,
    )
    table(
        doc,
        ["Dominio", "Entidades clave ya previstas", "Resultado empresarial"],
        [
            ["Ventas", "products, customers, orders, order_items", "Demanda y ticket."],
            ["Operación", "locations, inventory_lots, audit_events", "Control y evidencia."],
            ["Producción", "bird_batches, feed_consumption, harvest_batches", "Costo de pollo."],
            ["Molino", "formulas, inputs, mill_batches", "Costo alimento/servicio."],
            ["Circularidad", "byproducts, processes, outputs", "Aprovechamiento medible."],
        ],
        widths=[2.8, 7.2, 6.1],
    )
    callout(
        doc,
        "Pregunta rectora",
        "¿De dónde vino el producto, cuánto costó, a quién se vendió, cómo se entregó y qué margen dejó?",
    )
    page_break(doc)

    # Roadmap
    heading(
        doc,
        "Roadmap de ejecución",
        number="14",
        subtitle="Se construye por capacidades completas: confianza primero, recurrencia después y ecosistema solo con evidencia.",
    )
    table(
        doc,
        ["Fase", "Resultado esperado", "Marketing", "Desarrollo / operación"],
        [
            ["Ahora | Base", "Oferta y diseño de sistema.", "Marca, contenido y validación.", "Catálogo y cotizador construidos."],
            ["0-30 días | Venta real", "Primer pedido premium.", "Promesa, fotos y entrega.", "Auth, Supabase, stock y pedido."],
            ["31-90 días | Control", "Margen y cumplimiento.", "Recompra y experiencia.", "Inventario, lotes, estados."],
            ["3-6 meses | Recurrencia", "Weekly Box validada.", "Suscripción y comunidad.", "CRM, preferencias y entregas."],
            ["6-12 meses | Escala", "B2B y producción visible.", "Historia verificable.", "Molino, pagos, sedes y QR."],
            ["12+ meses | 360", "Nuevas producciones.", "Marca circular verificable.", "Cerdo/circularidad evaluados."],
        ],
        widths=[3.0, 4.3, 4.3, 4.7],
        text_size=8.3,
    )
    label(doc, "CRITERIOS DE PASO")
    bullet(doc, "No pasar a venta masiva hasta operar pedidos, stock, entrega y conciliación de pago.")
    bullet(doc, "No lanzar suscripción hasta garantizar abastecimiento y ventana de entrega.")
    bullet(doc, "No comunicar producción propia o circularidad sin lote y evidencia verificable.")
    bullet(doc, "No expandir sedes sin roles, inventario por ubicación y reportes comparables.")
    page_break(doc)

    # Development backlog
    heading(
        doc,
        "Backlog de desarrollo priorizado",
        number="15",
        subtitle="Orden propuesto para convertir la demostración funcional en un sistema operativo real.",
    )
    table(
        doc,
        ["Prioridad", "Entrega", "Criterio de aceptación", "Responsable"],
        [
            ["P0", "Supabase + Auth + RLS", "Admin ingresa con rol y datos quedan persistidos.", "Desarrollo"],
            ["P0", "Pedidos productivos", "Pedido numerado, estado, cliente y pago guardados.", "Desarrollo"],
            ["P0", "Precios y stock", "No se vende producto sin precio/stock validado.", "Operación + Dev"],
            ["P1", "Delivery exacto", "Dirección calcula zona/tarifa/ventana.", "Dev + Logística"],
            ["P1", "Inventario y lotes", "Despacho identifica origen y merma.", "Operación + Dev"],
            ["P1", "Trazabilidad visible", "Lote/origen publicable mediante QR validado.", "Operación + Dev"],
            ["P1", "Dashboard negocio", "Conversión, recompra, margen y entrega visibles.", "Dev + Dirección"],
            ["P2", "Weekly Box / CRM", "Pausa, frecuencia y recompra controlados.", "Comercial + Dev"],
            ["P2", "B2B / tiendas", "Precios y sedes separadas por permisos.", "Dirección + Dev"],
        ],
        widths=[1.8, 4.5, 7.0, 3.1],
        text_size=8.2,
    )
    callout(
        doc,
        "Control de release",
        "La rama actual valida el producto. El lanzamiento comercial debe ejecutarse en un entorno productivo con copias de seguridad, variables seguras y monitoreo.",
        fill=COOL,
    )
    page_break(doc)

    # Marketing backlog
    heading(
        doc,
        "Backlog de marketing y contenidos",
        number="16",
        subtitle="El equipo creativo debe volver visible la confianza operativa y medir intención de recompra.",
    )
    table(
        doc,
        ["Activo", "Entregable", "Uso en plataforma", "Definición pendiente"],
        [
            ["Identidad", "Manual premium: tono, sello, empaque.", "Portada, redes y entrega.", "Aprobación de marca."],
            ["Producto", "Fotos reales y textos por SKU.", "Tarjetas, packs y campañas.", "Precios y peso."],
            ["Origen", "Registro visual de pollo/granja.", "Confianza y diferenciación.", "Evidencias autorizadas."],
            ["Delivery", "Empaque, etiqueta y FAQs.", "Experiencia de recepción.", "Control térmico/rutas."],
            ["CRM", "Mensajes y Weekly Box.", "WhatsApp y recurrencia.", "Consentimiento/contacto."],
            ["B2B", "Ficha comercial y precios volumen.", "Ventas directas.", "Margen mínimo."],
        ],
        widths=[2.7, 5.2, 4.5, 3.9],
        text_size=8.3,
    )
    label(doc, "CALENDARIO EDITORIAL PILOTO")
    two_column_cards(
        doc,
        [
            ("Lunes | Confianza", "Origen, lote o proceso real que la marca puede probar."),
            ("Miércoles | Sistema", "Empaque, entrega, control o preparación precisa."),
            ("Viernes | Conversión", "Pack disponible y llamada elegante al pedido."),
            ("Postventa | Recompra", "Experiencia, cuidado y propuesta Weekly Box."),
        ],
    )
    page_break(doc)

    # KPI governance
    heading(
        doc,
        "Indicadores y forma de trabajo",
        number="17",
        subtitle="Un proyecto grande se gobierna con métricas compartidas y responsables explícitos.",
    )
    table(
        doc,
        ["Dimensión", "Indicador inicial", "Frecuencia", "Dueño"],
        [
            ["Marketing", "Visitas, intención, costo por pedido y marca.", "Semanal", "Marketing"],
            ["Comercial", "Pedidos, ticket premium y recompra 30 días.", "Semanal", "Ventas"],
            ["Entrega", "Tiempo, pedidos completos, costo delivery.", "Diaria/Semanal", "Operación"],
            ["Inventario", "Stock, merma, lotes despachados.", "Diaria", "Almacén"],
            ["Producción", "Costo/kg pollo, consumo alimento, mortalidad.", "Por lote", "Granja"],
            ["Finanzas", "Margen por producto/canal, caja.", "Semanal/Mensual", "Dirección"],
        ],
        widths=[2.7, 7.0, 3.2, 3.5],
        text_size=8.3,
    )
    label(doc, "RITUALES DEL EQUIPO")
    table(
        doc,
        ["Ritual", "Participantes", "Resultado obligatorio"],
        [
            ["Revisión semanal de venta", "Marketing, ventas, dirección", "Campañas, conversión y demanda."],
            ["Operación diaria", "Ventas, almacén, reparto", "Pedidos y entregas sin incidencia."],
            ["Sprint quincenal", "Desarrollo + responsables", "Capacidad demostrable liberada."],
            ["Comité mensual 360", "Dirección y líderes", "Margen, expansión y riesgos."],
        ],
        widths=[4.0, 5.3, 7.0],
        text_size=8.3,
    )
    page_break(doc)

    # Decisions and risk
    heading(
        doc,
        "Riesgos y decisiones a cerrar",
        number="18",
        subtitle="La siguiente reunión debe convertir información pendiente en definiciones operables.",
    )
    table(
        doc,
        ["Riesgo", "Impacto", "Mitigación inmediata"],
        [
            ["Origen no documentado", "Pérdida de confianza.", "Mantener sello pendiente hasta evidencia."],
            ["Precio/stock incompleto", "Pedidos imposibles de cumplir.", "Cerrar catálogo antes de campaña."],
            ["Datos locales en producción", "Pérdida o fuga de información.", "Migrar a Supabase con Auth."],
            ["Delivery sin ruta exacta", "Margen y promesa fallan.", "Validar cobertura y geocodificar."],
            ["Expansión prematura", "Costos sin control.", "Exigir margen y trazabilidad primero."],
            ["Guerra de precios", "Marca commodity y bajo margen.", "Pricing sustentado en experiencia."],
            ["Cumplimiento sanitario", "Riesgo legal/comercial.", "Asesoría especializada por línea."],
        ],
        widths=[4.0, 5.1, 7.2],
        text_size=8.3,
    )
    label(doc, "TALLER DE DECISIONES - RESPONSABLE Y FECHA")
    table(
        doc,
        ["Decisión requerida", "Resultado a documentar", "Dueño sugerido"],
        [
            ["Precios y margen mínimo", "Lista de precios v1 y costos.", "Dirección / finanzas"],
            ["Origen huevos y cuy", "Proveedor o lote propio verificado.", "Operación"],
            ["Cobertura y horarios", "Zonas, capacidad y tarifa.", "Ventas / logística"],
            ["Accesos internos", "Usuarios y permisos reales.", "Dirección / desarrollo"],
            ["Campaña piloto", "Presupuesto, creatividades y métrica.", "Marketing"],
            ["Experiencia premium", "Empaque, etiqueta y protocolo de entrega.", "Marketing / operación"],
        ],
        widths=[4.8, 7.3, 4.2],
        text_size=8.3,
    )
    page_break(doc)

    # Closing
    heading(
        doc,
        "Plan de arranque conjunto",
        number="19",
        subtitle="La marca de confianza ya tiene dirección; ahora debe conectarse a una operación impecable.",
    )
    callout(
        doc,
        "Objetivo de los próximos 30 días",
        "Publicar una versión productiva controlada que capture pedidos reales en Trujillo, entregue una experiencia premium medible y mantenga trazabilidad honesta por producto.",
        fill=MINT,
    )
    table(
        doc,
        ["Día 1-5", "Día 6-15", "Día 16-30"],
        [
            [
                "Promesa, precios, orígenes, empaque, fotos y zonas definidos.",
                "Base productiva, pedido, stock, entrega y pruebas listos.",
                "Campaña premium, entregas medidas y primera revisión de margen.",
            ]
        ],
        widths=[5.45, 5.45, 5.45],
    )
    label(doc, "MATERIALES DE BASE DISPONIBLES")
    bullet(doc, "Aplicación nueva: platform/ con tienda, gestión, APIs y migración de base de datos.")
    bullet(doc, "Definición empresarial: docs/PLATAFORMA_EMPRESARIAL.md.")
    bullet(doc, "Modelo de datos: docs/MODELO_DE_DATOS.md.")
    bullet(doc, "Roadmap: docs/ROADMAP_IMPLEMENTACION.md.")
    bullet(doc, "Archivo de alimentación actual pendiente de integrar al módulo de molino y costos.")
    paragraph(doc, "", space_after=12)
    callout(
        doc,
        "Cierre",
        "BioGranja 51 no crecerá por vender más pollo, sino por construir una nueva generación de alimentación confiable: premium, trazable, recurrente y operacionalmente precisa.",
        fill=FOREST,
        title_color="FFFFFF",
        body_color="FFFFFF",
    )
    paragraph(doc, "Fin del informe | BioGranja 51 | Mayo 2026", size=8.5, color=MUTED)

    doc.core_properties.title = "Informe Integral BioGranja 51 - Marketing, Desarrollo y Operación"
    doc.core_properties.subject = "Visión unificada de marca premium, plataforma y crecimiento"
    doc.core_properties.author = "BioGranja 51"
    doc.core_properties.comments = "Documento de trabajo generado para planificación del proyecto."
    doc.save(DOCX_PATH)
    print(DOCX_PATH)


if __name__ == "__main__":
    build_document()
