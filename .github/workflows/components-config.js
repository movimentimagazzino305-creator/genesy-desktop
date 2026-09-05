/**
 * Sistema di Gestione Componenti Modulari
 * Permette di definire, configurare e personalizzare graficamente tutti i blocchi del template
 */

// === CONFIGURAZIONE GLOBALE COMPONENTI ===
window.componentsConfig = {
    // Header Components
    header: {
        logo: {
            enabled: true,
            gridColumn: 'span 2',
            styles: {
                width: '100%',
                height: '100%',
                minHeight: '60px',
                textAlign: 'right',
                objectFit: 'contain',
                objectPosition: 'right top'
            },
            customable: ['width', 'height', 'minHeight', 'objectFit', 'objectPosition', 'gridColumn']
        },
        companyInfo: {
            enabled: true,
            gridColumn: 'span 6',
            styles: {
                paddingTop: '5px',
                textAlign: 'center'
            },
            elements: {
                companyName: {
                    text: 'Parquet Romagna S.r.l.',
                    styles: {
                        fontWeight: '700',
                        fontSize: '1rem',
                        color: '#1e293b',
                        marginBottom: '4px'
                    }
                },
                addresses: {
                    items: [
                        'Forlì - Via A. Panagulis 7',
                        'Cesena - Via Savio, 15',
                        'Ravenna - Via Canale Molinetto, 31',
                        'Riccione - Viale Murano, 24',
                        'Bologna - Via J. Cage, 7',
                        'Farra di Soligo - Via del sole, 24'
                    ],
                    styles: {
                        fontSize: '0.72rem',
                        color: '#334155',
                        lineHeight: '1.15'
                    }
                }
            },
            customable: ['textAlign', 'gridColumn', 'fontSize', 'color', 'lineHeight']
        },
        docInfo: {
            enabled: true,
            gridColumn: 'span 4',
            elements: {
                title: {
                    text: 'Preventivo',
                    styles: {
                        fontSize: '1.8rem',
                        fontWeight: '700',
                        color: '#cbd5e1',
                        textTransform: 'uppercase'
                    }
                },
                date: {
                    format: 'dd/mm/yyyy',
                    styles: {
                        fontSize: '0.95rem',
                        color: '#64748b',
                        marginBottom: '10px'
                    }
                },
                client: {
                    styles: {
                        border: '1px dashed #cbd5e1',
                        padding: '10px',
                        borderRadius: '6px',
                        background: '#f8fafc',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                    }
                }
            },
            customable: ['gridColumn', 'fontSize', 'color', 'textTransform']
        },
        subtitle: {
            enabled: true,
            gridColumn: 'span 6',
            items: [
                'Progettazione, fornitura e posa in opera',
                'Parquet, Decking e Resilienti',
                'Ripristino e riparazioni Parquet'
            ],
            styles: {
                fontSize: '0.85rem',
                color: '#475569',
                paddingTop: '4px',
                borderTop: '1px solid #334155',
                fontStyle: 'italic'
            },
            customable: ['fontSize', 'color', 'borderTop', 'gridColumn']
        },
        agentWidget: {
            enabled: true,
            gridColumn: 'span 6',
            styles: {
                fontSize: '0.75rem',
                color: '#334155',
                lineHeight: '1.4',
                textAlign: 'center',
                paddingTop: '10px'
            },
            elements: {
                name: {
                    editable: true,
                    styles: {
                        fontWeight: '700',
                        minHeight: '1.2em'
                    }
                },
                phone: {
                    icon: 'fa-phone',
                    editable: true,
                    styles: {
                        color: '#64748b',
                        fontSize: '0.85rem'
                    }
                },
                email: {
                    icon: 'fa-envelope',
                    editable: true,
                    styles: {
                        color: '#64748b',
                        fontSize: '0.85rem'
                    }
                }
            },
            customable: ['gridColumn', 'fontSize', 'color', 'textAlign']
        }
    },

    // Items Table Component
    itemsTable: {
        enabled: true,
        draggable: true,
        columns: {
            description: {
                label: 'Descrizione & Articolo',
                width: '55%',
                align: 'left',
                editable: true,
                styles: {
                    fontWeight: '400',
                    fontSize: '0.9rem'
                }
            },
            uom: {
                label: 'U.M.',
                width: '8%',
                align: 'center',
                editable: true,
                styles: {
                    fontSize: '0.85rem'
                }
            },
            quantity: {
                label: 'Q.tà',
                width: '8%',
                align: 'right',
                editable: true,
                type: 'number',
                styles: {
                    fontWeight: '600'
                }
            },
            price: {
                label: 'Prezzo',
                width: '12%',
                align: 'right',
                editable: true,
                type: 'currency',
                format: '€',
                styles: {
                    fontWeight: '600',
                    color: '#059669'
                }
            },
            total: {
                label: 'Totale',
                width: '17%',
                align: 'right',
                editable: false,
                calculated: true,
                type: 'currency',
                format: '€',
                styles: {
                    fontWeight: '700',
                    color: '#1e293b',
                    background: '#f0f9ff'
                }
            }
        },
        styles: {
            borderCollapse: 'collapse',
            width: '100%',
            marginBottom: '1rem'
        },
        headerStyles: {
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            color: 'white',
            padding: '12px 8px',
            fontSize: '0.85rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        },
        rowStyles: {
            borderBottom: '1px solid #e2e8f0',
            padding: '5px 8px'
        },
        alternateRowColor: '#f8fafc',
        customable: ['headerStyles', 'rowStyles', 'columns']
    },

    // Totals Section Component
    totals: {
        enabled: true,
        position: 'right', // 'left', 'right', 'bottom'
        showNotesField: true,
        items: {
            subtotal: {
                label: 'Imponibile',
                enabled: true,
                styles: {
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#475569'
                }
            },
            vat: {
                label: 'IVA',
                enabled: true,
                configurable: true,
                options: [
                    { value: 0, label: 'Esclusa' },
                    { value: 0.04, label: '4%' },
                    { value: 0.10, label: '10%' },
                    { value: 0.22, label: '22%' }
                ],
                styles: {
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    color: '#64748b'
                }
            },
            total: {
                label: 'TOTALE',
                enabled: true,
                styles: {
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    borderTop: '2px solid #0ea5e9',
                    paddingTop: '8px'
                }
            }
        },
        notesField: {
            defaultText: 'Il presente preventivo ha una validita\' di gg. 30\nIl preventivo si intende valido salvo sopraluogo',
            placeholder: 'Note interne, promemoria o informazioni riservate...',
            styles: {
                minHeight: '120px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem',
                fontSize: '0.85rem'
            }
        },
        customable: ['position', 'fontSize', 'color', 'fontWeight']
    },

    // Footer Components
    footer: {
        clientNotes: {
            enabled: true,
            label: 'Note per il cliente',
            defaultText: 'I prezzi si intendono comprensivi di : Fornitura, Trasporto, Colla , Posa in opera pavimento, battiscopa , Sfrido* pavimento, Sfrido* battiscopa',
            styles: {
                fontSize: '0.9rem',
                padding: '1rem',
                background: '#f8fafc',
                borderLeft: '4px solid #0ea5e9',
                marginBottom: '1rem'
            },
            customable: ['fontSize', 'background', 'borderLeft', 'padding']
        },
        legalNotes: {
            enabled: true,
            columns: 2,
            items: {
                generalNotes: {
                    title: 'Note Generali:',
                    text: 'Note Generali:\nIl preventivo (se comprensivo di posa) non include eventuali aumenti o costi extra per imprevisti. I prezzi si intendono validi per materiale non fornito ai piani, locali sgombri e massetti idonei. Contributo smaltimento materiali: € 49,30.',
                    styles: {
                        fontSize: '0.65rem',
                        lineHeight: '1.2'
                    }
                },
                technicalGlossary: {
                    title: 'Glossario Tecnico:',
                    text: '<em>Sfrido:</em> Quantità di materiale tecnicamente persa durante taglio e posa (scarto inevitabile per adattamento).<br><br><em>Spazzolatura:</em> Trattamento che risalta la venatura del legno e ne aumenta la resistenza superficiale.',
                    styles: {
                        fontSize: '0.65rem',
                        lineHeight: '1.2'
                    }
                }
            },
            styles: {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                marginBottom: '0.5rem'
            },
            customable: ['columns', 'fontSize', 'lineHeight', 'gap']
        },
        bottomBar: {
            enabled: true,
            elements: {
                sustainability: {
                    icon: 'fa-earth-europe',
                    text: 'sostenibilità e bellezza<br>per un futuro verde',
                    styles: {
                        color: '#166534',
                        fontSize: '0.55rem',
                        fontWeight: '700',
                        textTransform: 'lowercase'
                    }
                },
                socials: {
                    enabled: true,
                    title: 'SEGUICI:',
                    links: [
                        { icon: 'fa-instagram', url: '#' },
                        { icon: 'fa-facebook', url: '#' },
                        { icon: 'fa-linkedin', url: '#' },
                        { icon: 'fa-tiktok', url: '#' }
                    ],
                    styles: {
                        fontSize: '0.8rem'
                    }
                },
                recycleBadge: {
                    icon: 'fa-recycle',
                    text: 'carta riciclata',
                    styles: {
                        fontSize: '0.55rem',
                        color: '#94a3b8',
                        textTransform: 'lowercase'
                    }
                }
            },
            styles: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                padding: '8px 0',
                fontSize: '0.65rem'
            },
            customable: ['fontSize', 'padding', 'justifyContent']
        },
        signature: {
            enabled: false, // Hidden by default
            fields: {
                placeDate: {
                    label: 'Luogo e Data:',
                    width: '45%'
                },
                stampSignature: {
                    label: 'Timbro e Firma per Accettazione:',
                    width: '45%',
                    align: 'right'
                }
            },
            styles: {
                marginTop: '2rem',
                borderTop: '2px solid #ccc',
                paddingTop: '2rem'
            },
            customable: ['marginTop', 'borderTop', 'fields']
        }
    }
};

// === FUNZIONI PER APPLICARE LA CONFIGURAZIONE ===

/**
 * Applica gli stili di un componente all'elemento DOM
 */
window.applyComponentStyles = function (element, styles) {
    if (!element || !styles) return;

    Object.keys(styles).forEach(property => {
        const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
        element.style[property] = styles[property];
    });
};

/**
 * Ottiene la configurazione di un componente
 */
window.getComponentConfig = function (componentPath) {
    const parts = componentPath.split('.');
    let config = window.componentsConfig;

    for (const part of parts) {
        if (config[part]) {
            config = config[part];
        } else {
            return null;
        }
    }

    return config;
};

/**
 * Aggiorna la configurazione di un componente
 */
window.updateComponentConfig = function (componentPath, property, value) {
    const parts = componentPath.split('.');
    let config = window.componentsConfig;

    for (let i = 0; i < parts.length - 1; i++) {
        if (!config[parts[i]]) {
            config[parts[i]] = {};
        }
        config = config[parts[i]];
    }

    const lastPart = parts[parts.length - 1];
    if (!config[lastPart]) {
        config[lastPart] = {};
    }

    if (typeof config[lastPart] === 'object' && !Array.isArray(config[lastPart])) {
        config[lastPart][property] = value;
    } else {
        config[lastPart] = value;
    }

    // Salva la configurazione nel localStorage
    saveComponentsConfig();
};

/**
 * Salva la configurazione nel localStorage
 */
window.saveComponentsConfig = function () {
    try {
        localStorage.setItem('preventivi_components_config', JSON.stringify(window.componentsConfig));
    } catch (error) {
        console.error('❌ Errore nel salvataggio della configurazione:', error);
    }
};

/**
 * Carica la configurazione dal localStorage
 */
window.loadComponentsConfig = function () {
    try {
        const saved = localStorage.getItem('preventivi_components_config');
        if (saved) {
            window.componentsConfig = JSON.parse(saved);

            // PATCH: Ensure new Bologna address is present in saved config
            try {
                const newAddress = 'Bologna - Via J. Cage, 7';
                const companyInfo = window.componentsConfig.header?.companyInfo;
                if (companyInfo?.elements?.addresses?.items) {
                    if (!companyInfo.elements.addresses.items.includes(newAddress)) {
                        companyInfo.elements.addresses.items.push(newAddress);
                        localStorage.setItem('preventivi_components_config', JSON.stringify(window.componentsConfig));
                    }
                }
            } catch (e) { console.error('Error patching config', e); }
            return true;
        }
    } catch (error) {
        console.error('❌ Errore nel caricamento della configurazione:', error);
    }
    return false;
};

/**
 * Resetta la configurazione ai valori di default
 */
window.resetComponentsConfig = function () {
    if (confirm('Sei sicuro di voler ripristinare la configurazione predefinita? Tutte le personalizzazioni verranno perse.')) {
        localStorage.removeItem('preventivi_components_config');
        location.reload();
    }
};

/**
 * Esporta la configurazione corrente come JSON
 */
window.exportComponentsConfig = function () {
    const dataStr = JSON.stringify(window.componentsConfig, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `components-config-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
};

/**
 * Importa una configurazione da file JSON
 */
window.importComponentsConfig = function (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const config = JSON.parse(e.target.result);
            window.componentsConfig = config;
            saveComponentsConfig();
            alert('✅ Configurazione importata con successo! La pagina verrà ricaricata.');
            location.reload();
        } catch (error) {
            alert('❌ Errore nell\'importazione: ' + error.message);
        }
    };
    reader.readAsText(file);
};

// === INIZIALIZZAZIONE ===
document.addEventListener('DOMContentLoaded', function () {
    // Carica la configurazione salvata o usa quella di default
    loadComponentsConfig();
});
