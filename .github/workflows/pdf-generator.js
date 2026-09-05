/**
 * PDF Generator for Genesy
 * Uses PDFMake to generate quotes client-side.
 */

async function getBase64ImageFromUrl(imageUrl) {
    try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => resolve(reader.result));
            reader.addEventListener("error", () => reject(reader.error));
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Image Load Failed", imageUrl, e);
        return null;
    }
}

window.generateQuotePDFDefinition = async function (quote) {
    const isOrder = (quote.status === 'Chiuso' || quote.status === 'Ordine Confermato');
    const titleText = isOrder ? "CONFERMA D'ORDINE" : "PREVENTIVO";

    // Determine visibility
    const prefs = (quote.customer && quote.customer.printPrefs)
        ? (isOrder ? quote.customer.printPrefs.order : quote.customer.printPrefs.quote)
        : (isOrder
            ? { vat: true, sdi: true, address: true, site: true, contact: true, email: true, phone: true }
            : { vat: true, sdi: false, address: true, site: true, contact: true, email: false, phone: false }
        );

    // Prepare Customer Text
    let customerStack = [];
    if (quote.customer) {
        customerStack.push({ text: 'Spett.le Cliente', style: 'labelSmall' });
        customerStack.push({ text: quote.customer.name || '', style: 'customerName' });

        if (prefs.address && quote.customer.address) {
            let addr = quote.customer.address;
            if (quote.customer.zip || quote.customer.city) {
                addr += ` - ${quote.customer.zip || ''} ${quote.customer.city || ''} ${quote.customer.addressProvince ? '(' + quote.customer.addressProvince + ')' : ''}`;
            }
            customerStack.push({ text: addr, style: 'normalText', margin: [0, 0, 0, 2] });
        }

        let metaLine = [];
        if (prefs.vat && quote.customer.vat) metaLine.push(`P.IVA: ${quote.customer.vat}`);
        if (quote.customer.fiscal_code) metaLine.push(`C.F.: ${quote.customer.fiscal_code}`);
        if (prefs.email && quote.customer.email) metaLine.push(`✉ ${quote.customer.email}`);
        if (prefs.phone && quote.customer.phone) metaLine.push(`📞 ${quote.customer.phone}`);

        if (metaLine.length > 0) {
            customerStack.push({ text: metaLine.join('   '), style: 'smallText', color: '#666666' });
        }
    }

    // Site Info
    let siteStack = [];
    if (prefs.site && quote.customer && quote.customer.siteAddress) {
        siteStack.push({ text: 'Cantiere/Contatto', style: 'labelSmall' });
        siteStack.push({ text: quote.customer.siteAddress, style: 'normalText' });
        if (prefs.contact && quote.customer.contactPerson) {
            siteStack.push({ text: `Alla c.a.: ${quote.customer.contactPerson}`, style: 'smallText', margin: [0, 2, 0, 0] });
        }
    }

    // Items
    const tableBody = [];
    // Header
    tableBody.push([
        { text: 'DESCRIZIONE', style: 'tableHeader', alignment: 'left' },
        { text: 'U.M.', style: 'tableHeader', alignment: 'center' },
        { text: 'Q.TÀ', style: 'tableHeader', alignment: 'right' },
        { text: 'PREZZO', style: 'tableHeader', alignment: 'right' },
        { text: 'TOTALE', style: 'tableHeader', alignment: 'right' }
    ]);

    // Rows
    quote.items.forEach(item => {
        // --- FREE TEXT ROW (type: 'text') ---
        if (item.type === 'text') {
            if (item.printOnPdf === false) return; // Skip if not marked for print
            tableBody.push([
                {
                    text: item.description || '',
                    italics: true,
                    color: '#374151',
                    fontSize: 10,
                    colSpan: 5,
                    margin: [0, 3, 0, 3],
                    border: [false, false, false, true],
                    borderColor: ['', '', '', '#d97706']
                },
                {}, {}, {}, {}
            ]);
            return;
        }

        const totalCell = (item.total === 0)
            ? { text: 'OMAGGIO', color: '#27ae60', bold: true, alignment: 'right', fontSize: 10 }
            : { text: formatCurrency(item.total), alignment: 'right', fontSize: 10, bold: true, fontFamily: 'RobotoMono' };

        const priceCell = (item.unitPrice === 0)
            ? { text: 'OMAGGIO', alignment: 'right', fontSize: 10 }
            : { text: formatCurrency(item.unitPrice), alignment: 'right', fontSize: 10, fontFamily: 'RobotoMono' };

        // Description Stack
        const descStack = [{ text: item.description || '', bold: true }];
        if (item.category) descStack.push({ text: item.category, fontSize: 8, color: '#7f8c8d' });
        if (item.notes) descStack.push({ text: item.notes, fontSize: 9, italics: true, color: '#555555' });

        tableBody.push([
            { stack: descStack, margin: [0, 2] },
            { text: item.uom || '', alignment: 'center', margin: [0, 2] },
            { text: item.quantity || 0, alignment: 'right', margin: [0, 2], fontFamily: 'RobotoMono' },
            { ...priceCell, margin: [0, 2] },
            { ...totalCell, margin: [0, 2] }
        ]);
    });

    // Solo righe popolate — no righe vuote di padding

    // Map vatRate to label and percentage
    let vatLabel = '22%';
    let vatPercent = 22;
    if (quote.vatRate !== undefined && quote.vatRate !== null) {
         if (quote.vatRate === '0_rc') {
             vatLabel = 'Art. 17, comma 6, D.P.R. 633/1972 a ter';
             vatPercent = 0;
         } else if (quote.vatRate === '0_apply') {
             vatLabel = 'da applicare';
             vatPercent = 0;
         } else if (quote.vatRate === '0_zero' || quote.vatRate === 0 || quote.vatRate === '0') {
             vatLabel = '0%';
             vatPercent = 0;
         } else {
             const parsedVat = parseFloat(quote.vatRate);
             if (isNaN(parsedVat)) {
                 vatPercent = 22;
                 vatLabel = '22%';
             } else {
                 vatPercent = parsedVat <= 1 ? parsedVat * 100 : parsedVat;
                 vatLabel = `${vatPercent}%`;
             }
         }
     }

    // Totals
    const taxAmount = (quote.total * vatPercent) / 100;
    const finalTotal = quote.total + taxAmount;
    const discountValue = quote.discount || 0;

    // Logo
    let logoPath = 'logo_parquet_romagna_final.png';
    let brandText1 = 'PARQUET';
    let brandText2 = 'ROMAGNA';
    let companyName = 'Parquet Romagna S.r.l.';

    const venetoTargets = ['gallon marco', 'marco gallon', 'm.gallon@parquetveneto.it'];
    const bolognaTargets = ['filippo mondello', 'mondello filippo', 'f.mondello@parquetbologna.net'];
    
    let quoteAgent = quote.agent ? quote.agent.trim().toLowerCase() : '';
    
    if (venetoTargets.includes(quoteAgent)) {
        logoPath = 'logo_parquet_veneto.png';
        brandText2 = 'VENETO';
        companyName = 'Parquet Veneto';
    } else if (bolognaTargets.includes(quoteAgent)) {
        logoPath = 'logo_bologna.png';
        brandText2 = 'BOLOGNA';
        companyName = 'Parquet Bologna';
    }

    // Try to load logo (assuming logo.png is relative to root)
    let logoData = await getBase64ImageFromUrl(logoPath);

    // Document Definition
    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 40, 40, 120], // Footer space
        content: [
            // Header Section
            {
                columns: [
                    // Brand
                    {
                        width: 120,
                        stack: [
                            logoData ? { image: logoData, width: 100 } : { text: 'LOGO', fontSize: 20, bold: true },
                            { text: [{ text: brandText1, bold: true }, { text: ' ' + brandText2, bold: false }], alignment: 'center', fontSize: 12, margin: [0, 5, 0, 0] }
                        ]
                    },
                    // Info
                    {
                        width: '*',
                        stack: [
                            { text: titleText, alignment: 'right', fontSize: 22, bold: true, color: '#333333' },
                            { text: companyName, alignment: 'right', bold: true, fontSize: 14, margin: [0, 2, 0, 0] },
                            { text: 'Forlì - Via A. Panagulis 7 | Cesena - Via Savio, 15\nRavenna - Via Canale Molinetto, 31 | Riccione - Viale Murano, 24\nBologna - Via J. Cage, 7 | Farra di Soligo - Via del sole, 24', alignment: 'right', fontSize: 8, color: '#555555', margin: [0, 2, 0, 0] }
                        ]
                    }
                ]
            },
            { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#333333' }], margin: [0, 0, 0, 15] },

            // Meta Row
            {
                table: {
                    widths: ['*', '*', '*', '*'],
                    body: [[
                        { text: `Data: ${new Date(quote.date).toLocaleDateString()}`, fillColor: '#f8f9fa' },
                        { text: (prefs.sdi && quote.customer.sdi) ? `SDI: ${quote.customer.sdi}` : '', fillColor: '#f8f9fa' },
                        { text: quote.agent ? `Agente: ${quote.agent}` : '', fillColor: '#f8f9fa' },
                        { text: (quote.zone) ? `Zona: ${quote.zone}` : '', fillColor: '#f8f9fa' }
                    ]]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 20]
            },

            // Client & Site
            {
                columns: [
                    {
                        width: '*',
                        stack: customerStack,
                        margin: [10, 10, 10, 10]
                    },
                    (siteStack.length > 0) ? {
                        width: '40%',
                        stack: siteStack,
                        margin: [10, 10, 0, 10]
                    } : {}
                ],
                // Box border simulation via canvas? Or just simple columns. 
                // PDFMake native borders on columns is tricky. We'll use a table wrapper for the box look.
            },
            {
                // Box Wrapper for Customer
                table: {
                    widths: ['*'],
                    body: [[
                        {
                            columns: [
                                { width: '*', stack: customerStack },
                                (siteStack.length > 0) ? { width: 'auto', canvas: [{ type: 'line', x1: 0, y1: 0, x2: 0, y2: 60, lineColor: '#eeeeee' }], margin: [10, 0, 10, 0] } : {},
                                (siteStack.length > 0) ? { width: '40%', stack: siteStack } : {}
                            ]
                        }
                    ]]
                },
                layout: {
                    hLineWidth: function (i) { return (i === 0 || i === 1) ? 1 : 0; },
                    vLineWidth: function (i) { return (i === 0 || i === 1) ? 1 : 0; }, // Left Border Check?
                    paddingLeft: function (i) { return 10; },
                    paddingRight: function (i) { return 10; },
                    paddingTop: function (i) { return 10; },
                    paddingBottom: function (i) { return 10; },
                    defaultBorder: true
                },
                margin: [0, 0, 0, 20]
            },

            // Items Table
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 40, 50, 70, 70],
                    body: tableBody
                },
                layout: {
                    hLineWidth: function (i, node) {
                        return (i === 0 || i === 1) ? 2 : 1;
                    },
                    vLineWidth: function (i, node) { return 0; },
                    hLineColor: function (i, node) {
                        return (i === 0 || i === 1) ? '#333333' : '#eeeeee';
                    },
                    paddingTop: function (i) { return 8; },
                    paddingBottom: function (i) { return 8; }
                }
            },

            // Closing Text
            (isOrder && quote.closingText) ? { text: quote.closingText, margin: [0, 20, 0, 0], fontSize: 10 } : {},

            // Totals & Notes Section
            {
                margin: [0, 30, 0, 0],
                columns: [
                    // Left: Notes
                    {
                        width: '*',
                        stack: [
                            (quote.paymentMethod) ? {
                                text: [
                                    { text: 'Pagamento: ', bold: true },
                                    { text: quote.paymentMethod },
                                    (quote.iban) ? { text: `\nIBAN: ${quote.iban}`, bold: false } : ''
                                ],
                                fontSize: 10, background: '#f1f2f6', margin: [0, 0, 10, 10]
                            } : {},
                            (quote.notes) ? {
                                text: [
                                    { text: 'Note:\n', bold: true, color: '#555555', fontSize: 9 },
                                    { text: quote.notes, italics: true }
                                ],
                                fontSize: 10, margin: [0, 0, 10, 0]
                            } : {}
                        ]
                    },
                    // Right: Totals
                    {
                        width: 200,
                        stack: [
                            {
                                table: {
                                    widths: ['*', 'auto'],
                                    body: [
                                        [{ text: 'Imponibile:', color: '#666666' }, { text: formatCurrency(quote.total), bold: true, alignment: 'right' }],
                                        (discountValue > 0) ? [{ text: 'Sconto Info', color: '#c0392b' }, { text: `-${formatCurrency(discountValue)}`, color: '#c0392b', alignment: 'right' }] : null,
                                        [{ text: `IVA (${vatLabel}):`, color: '#666666' }, { text: formatCurrency(taxAmount), alignment: 'right' }],
                                    ].filter(row => row !== null)
                                },
                                layout: 'noBorders',
                                margin: [10, 10, 10, 10]
                            },
                            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1, lineColor: '#dddddd' }] },
                            {
                                columns: [
                                    { text: 'TOTALE', bold: true, fontSize: 14, margin: [10, 10, 0, 0] },
                                    { text: formatCurrency(finalTotal), bold: true, fontSize: 14, alignment: 'right', margin: [0, 10, 10, 0] }
                                ]
                            }
                        ],
                        fillColor: '#f8f9fa' // Bg for whole box simulated? No, PDFMake layout needed.
                        // We'll leave it simple.
                    }
                ]
            }
        ],
        footer: function (currentPage, pageCount) {
            return {
                margin: [40, 10, 40, 0],
                stack: [
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#dddddd' }] },
                    { text: 'Note Generali: Il preventivo (se comprensivo di posa) non include eventuali aumenti o costi extra per imprevisti. I prezzi si intendono validi per materiale non fornito ai piani, locali sgombri e massetti idonei. Contributo smaltimento materiali: € 49,30.', fontSize: 8, margin: [0, 5, 0, 2], color: '#555555' },
                    { text: 'Glossario Tecnico: Sfrido: Quantità di materiale tecnicamente persa durante taglio e posa (scarto inevitabile per adattamento). Spazzolatura: Trattamento che risalta la venatura del legno e ne aumenta la resistenza superficiale.', fontSize: 8, color: '#555555', italics: true },
                    { text: `Pagina ${currentPage} di ${pageCount}`, alignment: 'center', margin: [0, 10, 0, 0], fontSize: 9, color: '#999999' }
                ]
            };
        },
        styles: {
            header: { fontSize: 18, bold: true },
            labelSmall: { fontSize: 8, color: '#888888', bold: true, letterSpacing: 1 },
            customerName: { fontSize: 14, bold: true, margin: [0, 0, 0, 5] },
            normalText: { fontSize: 10 },
            smallText: { fontSize: 9 },
            tableHeader: { fontSize: 9, bold: true, color: 'black' }
        },
        defaultStyle: {
            font: 'Roboto' // Default font in vfs_fonts
        }
    };

    return docDefinition;
};
