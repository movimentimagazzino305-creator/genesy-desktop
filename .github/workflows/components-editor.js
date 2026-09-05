/**
 * Editor Visuale per Componenti
 * Interfaccia grafica per modificare tutti gli aspetti dei componenti del template
 */

// === APERTURA EDITOR COMPONENTI ===
window.openComponentsEditor = function () {
    // Crea o mostra il modal dell'editor
    let modal = document.getElementById('componentsEditorModal');

    if (!modal) {
        modal = createComponentsEditorModal();
        document.body.appendChild(modal);
    }

    // Popola l'editor con la configurazione corrente
    renderComponentsTree();

    // Mostra il modal
    modal.classList.remove('hidden');
};

// === CREAZIONE INTERFACCIA MODAL ===
function createComponentsEditorModal() {
    const modal = document.createElement('div');
    modal.id = 'componentsEditorModal';
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1200px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
            <header class="modal-header">
                <h2><i class="fa-solid fa-puzzle-piece"></i> Editor Componenti Template</h2>
                <span class="close-modal" onclick="closeComponentsEditor()">&times;</span>
            </header>
            
            <div class="modal-body" style="flex: 1; overflow: hidden; display: flex; gap: 20px; padding: 20px;">
                <!-- Sidebar: Tree Navigator -->
                <div style="width: 300px; border-right: 1px solid #e2e8f0; padding-right: 20px; overflow-y: auto;">
                    <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                        <button class="btn-primary btn-sm" onclick="saveComponentsConfig()" style="flex: 1;">
                            <i class="fa-solid fa-save"></i> Salva
                        </button>
                        <button class="btn-secondary btn-sm" onclick="exportComponentsConfig()" title="Esporta">
                            <i class="fa-solid fa-download"></i>
                        </button>
                        <button class="btn-secondary btn-sm" onclick="document.getElementById('importConfigFile').click()" title="Importa">
                            <i class="fa-solid fa-upload"></i>
                        </button>
                        <button class="btn-secondary btn-sm" onclick="resetComponentsConfig()" title="Reset">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                    </div>
                    <input type="file" id="importConfigFile" style="display: none;" accept=".json" onchange="importComponentsConfig(this.files[0])">
                    
                    <h3 style="font-size: 0.9rem; color: #64748b; text-transform: uppercase; margin-bottom: 10px;">Sezioni</h3>
                    <div id="componentsTree"></div>
                </div>
                
                <!-- Main: Properties Editor -->
                <div style="flex: 1; overflow-y: auto;">
                    <div id="componentPropertiesEditor">
                        <div style="text-align: center; padding: 40px; color: #94a3b8;">
                            <i class="fa-solid fa-hand-pointer" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                            <p>Seleziona un componente dall'elenco per modificarne le proprietà</p>
                        </div>
                    </div>
                </div>
                
                <!-- Preview Pane -->
                <div style="width: 350px; border-left: 1px solid #e2e8f0; padding-left: 20px; overflow-y: auto;">
                    <h3 style="font-size: 0.9rem; color: #64748b; text-transform: uppercase; margin-bottom: 10px;">
                        <i class="fa-solid fa-eye"></i> Anteprima
                    </h3>
                    <div id="componentPreview" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; min-height: 200px;">
                        <p style="color: #94a3b8; font-size: 0.85rem;">L'anteprima apparirà qui quando selezioni un componente</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    return modal;
}

// === CHIUSURA EDITOR ===
window.closeComponentsEditor = function () {
    const modal = document.getElementById('componentsEditorModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// === RENDERING TREE NAVIGATORE ===
function renderComponentsTree() {
    const container = document.getElementById('componentsTree');
    if (!container) return;

    container.innerHTML = '';

    // === HEADER ===
    const headerSection = createTreeSection('Header', 'fa-rectangle-ad', {
        'Logo': 'header.logo',
        'Informazioni Azienda': 'header.companyInfo',
        'Info Documento': 'header.docInfo',
        'Sottotitolo': 'header.subtitle',
        'Widget Agente': 'header.agentWidget'
    });
    container.appendChild(headerSection);

    // === TABELLA ARTICOLI ===
    const tableSection = createTreeSection('Tabella Articoli', 'fa-table', {
        'Configurazione Generale': 'itemsTable',
        'Colonna Descrizione': 'itemsTable.columns.description',
        'Colonna U.M.': 'itemsTable.columns.uom',
        'Colonna Quantità': 'itemsTable.columns.quantity',
        'Colonna Prezzo': 'itemsTable.columns.price',
        'Colonna Totale': 'itemsTable.columns.total'
    });
    container.appendChild(tableSection);

    // === TOTALI ===
    const totalsSection = createTreeSection('Sezione Totali', 'fa-calculator', {
        'Configurazione Generale': 'totals',
        'Imponibile': 'totals.items.subtotal',
        'IVA': 'totals.items.vat',
        'Totale Finale': 'totals.items.total',
        'Campo Note': 'totals.notesField'
    });
    container.appendChild(totalsSection);

    // === FOOTER ===
    const footerSection = createTreeSection('Footer', 'fa-rectangle-ad', {
        'Note Cliente': 'footer.clientNotes',
        'Note Legali': 'footer.legalNotes',
        'Barra Inferiore': 'footer.bottomBar',
        'Firma': 'footer.signature'
    });
    container.appendChild(footerSection);
}

// === CREAZIONE SEZIONE TREE ===
function createTreeSection(title, icon, items) {
    const section = document.createElement('div');
    section.className = 'tree-section';
    section.style.marginBottom = '15px';

    const header = document.createElement('div');
    header.style.cssText = 'font-weight: 600; font-size: 0.9rem; color: #1e293b; margin-bottom: 8px; padding: 8px; background: #f1f5f9; border-radius: 6px; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between;';
    
    const headerTitle = document.createElement('div');
    headerTitle.innerHTML = `<i class="fa-solid ${icon}" style="margin-right: 8px; color: #0ea5e9;"></i>${title}`;
    
    const chevron = document.createElement('i');
    chevron.className = 'fa-solid fa-chevron-down';
    chevron.style.cssText = 'font-size: 0.75rem; color: #64748b; transition: transform 0.2s;';

    header.appendChild(headerTitle);
    header.appendChild(chevron);

    const itemsList = document.createElement('div');
    itemsList.style.cssText = 'padding-left: 15px;';

    // Crea gli item della sezione
    Object.entries(items).forEach(([label, path]) => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.dataset.path = path;
        item.style.cssText = 'padding: 6px 10px; margin: 2px 0; border-radius: 4px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; color: #475569; display: flex; align-items: center;';
        item.innerHTML = `<i class="fa-solid fa-chevron-right" style="font-size: 0.7rem; margin-right: 6px; color: #94a3b8;"></i>${label}`;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.tree-item').forEach(el => {
                el.style.background = '';
                el.style.color = '#475569';
                el.style.fontWeight = 'normal';
            });

            item.style.background = '#e0f2fe';
            item.style.color = '#0369a1';
            item.style.fontWeight = '600';

            showComponentEditor(path);
        });

        item.addEventListener('mouseenter', () => {
            if (item.style.background !== 'rgb(224, 242, 254)' && item.style.background !== '#e0f2fe') {
                item.style.background = '#f8fafc';
            }
        });

        item.addEventListener('mouseleave', () => {
            if (item.style.background !== 'rgb(224, 242, 254)' && item.style.background !== '#e0f2fe') {
                item.style.background = '';
            }
        });

        itemsList.appendChild(item);
    });

    // Toggle collapse/expand
    let isExpanded = true;
    header.addEventListener('click', () => {
        isExpanded = !isExpanded;
        itemsList.style.display = isExpanded ? 'block' : 'none';
        chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    section.appendChild(header);
    section.appendChild(itemsList);

    return section;
}

// === MOSTRA EDITOR PER COMPONENTE SPECIFICO ===
function showComponentEditor(componentPath) {
    const config = getComponentConfig(componentPath);
    if (!config) {
        console.error('Configurazione non trovata per:', componentPath);
        return;
    }

    const editor = document.getElementById('componentPropertiesEditor');
    if (!editor) return;

    editor.innerHTML = '';

    // Header dell'editor
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;';
    const componentName = componentPath.split('.').pop().replace(/([A-Z])/g, ' $1').trim();
    header.innerHTML = `
        <h3 style="font-size: 1.1rem; color: #1e293b; margin-bottom: 5px; text-transform: capitalize;">
            ${componentName}
        </h3>
        <p style="font-size: 0.8rem; color: #64748b; font-family: monospace;">${componentPath}</p>
    `;
    editor.appendChild(header);

    const properties = document.createElement('div');
    properties.style.cssText = 'display: flex; flex-direction: column; gap: 15px;';

    // Genera controlli per l'oggetto di configurazione
    renderObjectControls(config, componentPath, properties);

    editor.appendChild(properties);

    // Mostra anteprima
    updateComponentPreview(componentPath);
}

// === RENDERING RIGOROSO E RICORSIVO DEI CONTROLLI ===
function renderObjectControls(obj, basePath, container) {
    if (!obj || typeof obj !== 'object') return;

    // 1. Controlli base (enabled, label, width, align, position, text, etc.)
    const directProps = ['enabled', 'gridColumn', 'position', 'label', 'text', 'defaultText', 'placeholder', 'width', 'align', 'type', 'format', 'columns'];
    
    directProps.forEach(prop => {
        if (obj.hasOwnProperty(prop)) {
            const val = obj[prop];
            let control;

            if (typeof val === 'boolean') {
                control = createToggleControl(formatPropLabel(prop), val, (newVal) => {
                    updateComponentConfig(basePath, prop, newVal);
                    updateComponentPreview(basePath.split('.')[0]);
                });
            } else if (prop === 'text' || prop === 'defaultText' || prop === 'placeholder') {
                control = createTextAreaControl(formatPropLabel(prop), val, (newVal) => {
                    updateComponentConfig(basePath, prop, newVal);
                    updateComponentPreview(basePath.split('.')[0]);
                });
            } else if (prop === 'align') {
                control = createSelectControl(formatPropLabel(prop), val, [
                    { value: 'left', label: 'Sinistra' },
                    { value: 'center', label: 'Centro' },
                    { value: 'right', label: 'Destra' }
                ], (newVal) => {
                    updateComponentConfig(basePath, prop, newVal);
                    updateComponentPreview(basePath.split('.')[0]);
                });
            } else if (prop === 'position') {
                control = createSelectControl(formatPropLabel(prop), val, [
                    { value: 'left', label: 'Sinistra' },
                    { value: 'right', label: 'Destra' },
                    { value: 'bottom', label: 'In basso' }
                ], (newVal) => {
                    updateComponentConfig(basePath, prop, newVal);
                    updateComponentPreview(basePath.split('.')[0]);
                });
            } else {
                control = createTextControl(formatPropLabel(prop), val, (newVal) => {
                    updateComponentConfig(basePath, prop, newVal);
                    updateComponentPreview(basePath.split('.')[0]);
                });
            }

            if (control) container.appendChild(control);
        }
    });

    // 2. Items List (se è un array)
    if (obj.items && Array.isArray(obj.items)) {
        const itemsControl = createListControl('Voci / Elementi', obj.items, (newItems) => {
            updateComponentConfig(basePath, 'items', newItems);
            updateComponentPreview(basePath.split('.')[0]);
        });
        container.appendChild(itemsControl);
    }

    // 3. Section Styles
    if (obj.styles && typeof obj.styles === 'object') {
        const stylesGroup = document.createElement('div');
        stylesGroup.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 10px;';
        
        const stylesHeader = document.createElement('h4');
        stylesHeader.innerHTML = '<i class="fa-solid fa-palette" style="margin-right: 6px; color: #0ea5e9;"></i> Stili Grafici';
        stylesHeader.style.cssText = 'font-size: 0.9rem; color: #334155; margin: 0 0 12px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;';
        stylesGroup.appendChild(stylesHeader);

        Object.entries(obj.styles).forEach(([property, value]) => {
            const styleControl = createStyleControl(property, value, (newValue) => {
                if (!obj.styles) obj.styles = {};
                obj.styles[property] = newValue;
                updateComponentConfig(basePath, 'styles', obj.styles);
                updateComponentPreview(basePath.split('.')[0]);
            });
            stylesGroup.appendChild(styleControl);
        });

        container.appendChild(stylesGroup);
    }

    // 4. Sub-Elements (e.g. elements, items sub-objects)
    const subGroups = ['elements', 'fields'];
    subGroups.forEach(groupName => {
        if (obj[groupName] && typeof obj[groupName] === 'object' && !Array.isArray(obj[groupName])) {
            const subContainer = document.createElement('div');
            subContainer.style.cssText = 'border-left: 3px solid #0ea5e9; padding-left: 12px; margin-top: 15px;';

            const subHeader = document.createElement('h4');
            subHeader.textContent = formatPropLabel(groupName);
            subHeader.style.cssText = 'font-size: 0.9rem; color: #0369a1; text-transform: uppercase; margin-bottom: 10px;';
            subContainer.appendChild(subHeader);

            Object.entries(obj[groupName]).forEach(([childKey, childVal]) => {
                if (typeof childVal === 'object' && childVal !== null) {
                    const childGroup = document.createElement('div');
                    childGroup.style.cssText = 'background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 10px;';
                    
                    const childTitle = document.createElement('div');
                    childTitle.style.cssText = 'font-weight: 600; font-size: 0.85rem; color: #334155; margin-bottom: 8px;';
                    childTitle.textContent = formatPropLabel(childKey);
                    childGroup.appendChild(childTitle);

                    renderObjectControls(childVal, `${basePath}.${groupName}.${childKey}`, childGroup);
                    subContainer.appendChild(childGroup);
                }
            });

            container.appendChild(subContainer);
        }
    });
}

function formatPropLabel(prop) {
    return prop.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
}

// === CONTROLLI UI (ROBUSTI E PULITI) ===

function createToggleControl(label, value, onChange) {
    const control = document.createElement('div');
    control.className = 'form-group';
    control.style.marginBottom = '10px';

    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;';

    const span = document.createElement('span');
    span.style.cssText = 'font-weight: 500; color: #334155; font-size: 0.88rem;';
    span.textContent = label;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!value;
    input.style.cssText = 'width: 18px; height: 18px; cursor: pointer; accent-color: #0ea5e9;';
    input.addEventListener('change', (e) => onChange(e.target.checked));

    labelEl.appendChild(span);
    labelEl.appendChild(input);
    control.appendChild(labelEl);
    return control;
}

function createTextControl(label, value, onChange, placeholder = '') {
    const control = document.createElement('div');
    control.className = 'form-group';
    control.style.marginBottom = '10px';

    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'font-weight: 500; color: #334155; margin-bottom: 4px; display: block; font-size: 0.85rem;';
    labelEl.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control';
    input.value = value != null ? value : '';
    input.placeholder = placeholder;
    input.style.cssText = 'width: 100%; font-size: 0.85rem; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px;';
    input.addEventListener('input', (e) => onChange(e.target.value));

    control.appendChild(labelEl);
    control.appendChild(input);
    return control;
}

function createTextAreaControl(label, value, onChange) {
    const control = document.createElement('div');
    control.className = 'form-group';
    control.style.marginBottom = '10px';

    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'font-weight: 500; color: #334155; margin-bottom: 4px; display: block; font-size: 0.85rem;';
    labelEl.textContent = label;

    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.rows = 3;
    textarea.value = value != null ? value : '';
    textarea.style.cssText = 'width: 100%; font-size: 0.85rem; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px; resize: vertical;';
    textarea.addEventListener('input', (e) => onChange(e.target.value));

    control.appendChild(labelEl);
    control.appendChild(textarea);
    return control;
}

function createSelectControl(label, value, options, onChange) {
    const control = document.createElement('div');
    control.className = 'form-group';
    control.style.marginBottom = '10px';

    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'font-weight: 500; color: #334155; margin-bottom: 4px; display: block; font-size: 0.85rem;';
    labelEl.textContent = label;

    const select = document.createElement('select');
    select.className = 'form-control';
    select.style.cssText = 'width: 100%; font-size: 0.85rem; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: white;';

    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => onChange(e.target.value));

    control.appendChild(labelEl);
    control.appendChild(select);
    return control;
}

function createStyleControl(property, value, onChange) {
    const control = document.createElement('div');
    control.className = 'form-group';
    control.style.marginBottom = '8px';

    const labelText = property.replace(/([A-Z])/g, ' $1').toLowerCase();
    const isColor = property.toLowerCase().includes('color') || property.toLowerCase().includes('background');

    if (isColor && typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb'))) {
        const labelEl = document.createElement('label');
        labelEl.style.cssText = 'font-weight: 500; color: #334155; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = labelText;

        const pickersDiv = document.createElement('div');
        pickersDiv.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        let hexVal = value.startsWith('#') ? value : '#000000';
        if (hexVal.length === 4) {
            hexVal = '#' + hexVal[1] + hexVal[1] + hexVal[2] + hexVal[2] + hexVal[3] + hexVal[3];
        }
        colorInput.value = hexVal;
        colorInput.style.cssText = 'width: 34px; height: 26px; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; padding: 0;';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'form-control';
        textInput.value = value;
        textInput.style.cssText = 'width: 110px; font-family: monospace; font-size: 0.8rem; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;';

        colorInput.addEventListener('input', (e) => {
            textInput.value = e.target.value;
            onChange(e.target.value);
        });

        textInput.addEventListener('input', (e) => {
            if (e.target.value.startsWith('#')) {
                colorInput.value = e.target.value;
            }
            onChange(e.target.value);
        });

        pickersDiv.appendChild(colorInput);
        pickersDiv.appendChild(textInput);
        labelEl.appendChild(nameSpan);
        labelEl.appendChild(pickersDiv);
        control.appendChild(labelEl);
    } else {
        const labelEl = document.createElement('label');
        labelEl.style.cssText = 'font-weight: 500; color: #334155; margin-bottom: 4px; display: block; font-size: 0.82rem;';
        labelEl.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.value = value != null ? value : '';
        input.style.cssText = 'width: 100%; font-family: monospace; font-size: 0.82rem; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px;';
        input.addEventListener('input', (e) => onChange(e.target.value));

        control.appendChild(labelEl);
        control.appendChild(input);
    }

    return control;
}

function createListControl(label, items, onChange) {
    const control = document.createElement('div');
    control.className = 'form-group';
    control.style.marginBottom = '12px';

    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'font-weight: 500; color: #334155; margin-bottom: 8px; display: block; font-size: 0.85rem;';
    labelEl.textContent = label;
    control.appendChild(labelEl);

    const listContainer = document.createElement('div');
    const currentItems = [...(items || [])];

    function renderList() {
        listContainer.innerHTML = '';
        currentItems.forEach((item, index) => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px; align-items: center;';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control';
            input.value = item != null ? item : '';
            input.style.cssText = 'flex: 1; font-size: 0.85rem; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px;';
            input.addEventListener('input', (e) => {
                currentItems[index] = e.target.value;
                onChange(currentItems);
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-icon delete';
            delBtn.type = 'button';
            delBtn.style.cssText = 'padding: 5px 8px; background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 4px; cursor: pointer;';
            delBtn.innerHTML = '<i class="fa-solid fa-trash" style="font-size: 0.8rem;"></i>';
            delBtn.addEventListener('click', () => {
                currentItems.splice(index, 1);
                renderList();
                onChange(currentItems);
            });

            row.appendChild(input);
            row.appendChild(delBtn);
            listContainer.appendChild(row);
        });
    }

    renderList();
    control.appendChild(listContainer);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary btn-sm';
    addBtn.style.cssText = 'margin-top: 6px; padding: 4px 10px; font-size: 0.8rem; cursor: pointer; border-radius: 4px;';
    addBtn.innerHTML = '<i class="fa-solid fa-plus" style="margin-right: 4px;"></i> Aggiungi Voce';
    addBtn.addEventListener('click', () => {
        currentItems.push('Nuovo elemento');
        renderList();
        onChange(currentItems);
    });
    control.appendChild(addBtn);

    return control;
}

// === UPDATE PREVIEW ===
function updateComponentPreview(componentPath) {
    const preview = document.getElementById('componentPreview');
    if (!preview) return;

    const mainSectionPath = componentPath ? componentPath.split('.')[0] : 'header';
    const config = getComponentConfig(mainSectionPath);
    if (!config) return;

    let previewHTML = '<div style="padding: 10px;">';

    if (config.styles) {
        const styleStr = Object.entries(config.styles)
            .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`)
            .join('; ');

        if (config.text) {
            previewHTML += `<div style="${styleStr}">${config.text}</div>`;
        } else if (config.items && Array.isArray(config.items)) {
            previewHTML += config.items.map(item => `<div style="${styleStr}">${item}</div>`).join('');
        } else {
            previewHTML += `<div style="${styleStr}">Esempio Componente (${mainSectionPath})</div>`;
        }
    } else {
        previewHTML += `<p style="color: #94a3b8; font-size: 0.85rem;">Anteprima della sezione <strong>${mainSectionPath}</strong></p>`;
    }

    previewHTML += '</div>';
    preview.innerHTML = previewHTML;
}
