Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$projectRoot = "i:\Il mio Drive\drive\Antigravity\Preventivi\Preventivi_v2.5"
$backupsDir  = Join-Path $projectRoot "Manual_Backups"

$form = New-Object System.Windows.Forms.Form
$form.Text            = "Gestione Backup - Preventivi v2.5"
$form.Size            = New-Object System.Drawing.Size(560, 520)
$form.StartPosition   = "CenterScreen"
$form.BackColor       = [System.Drawing.Color]::FromArgb(18, 18, 30)
$form.ForeColor       = [System.Drawing.Color]::White
$form.Font            = New-Object System.Drawing.Font("Segoe UI", 10)
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox     = $false

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text      = "Seleziona un backup"
$lblTitle.Font      = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(120, 200, 255)
$lblTitle.Location  = New-Object System.Drawing.Point(20, 20)
$lblTitle.Size      = New-Object System.Drawing.Size(510, 30)
$form.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text      = "Scegli un backup dalla lista, poi usa i tasti in basso."
$lblSub.ForeColor = [System.Drawing.Color]::FromArgb(160, 160, 180)
$lblSub.Location  = New-Object System.Drawing.Point(20, 55)
$lblSub.Size      = New-Object System.Drawing.Size(510, 20)
$form.Controls.Add($lblSub)

$sep = New-Object System.Windows.Forms.Label
$sep.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 80)
$sep.Location  = New-Object System.Drawing.Point(20, 83)
$sep.Size      = New-Object System.Drawing.Size(510, 1)
$form.Controls.Add($sep)

$listBox = New-Object System.Windows.Forms.ListBox
$listBox.Location      = New-Object System.Drawing.Point(20, 95)
$listBox.Size          = New-Object System.Drawing.Size(510, 240)
$listBox.BackColor     = [System.Drawing.Color]::FromArgb(28, 28, 45)
$listBox.ForeColor     = [System.Drawing.Color]::White
$listBox.Font          = New-Object System.Drawing.Font("Consolas", 10)
$listBox.BorderStyle   = "FixedSingle"
$listBox.SelectionMode = "One"
$form.Controls.Add($listBox)

function Refresh-List {
    $listBox.Items.Clear()
    $backups = Get-ChildItem -Path $backupsDir | Sort-Object Name -Descending
    foreach ($b in $backups) { $listBox.Items.Add($b.Name) | Out-Null }
    if ($listBox.Items.Count -gt 0) { $listBox.SelectedIndex = 0 }
}
Refresh-List

$lblDetail = New-Object System.Windows.Forms.Label
$lblDetail.ForeColor = [System.Drawing.Color]::FromArgb(180, 220, 180)
$lblDetail.Location  = New-Object System.Drawing.Point(20, 345)
$lblDetail.Size      = New-Object System.Drawing.Size(510, 40)
$form.Controls.Add($lblDetail)

function Update-Detail {
    if ($listBox.SelectedItem) {
        $sel   = Join-Path $backupsDir $listBox.SelectedItem
        $items = Get-ChildItem $sel -Recurse -ErrorAction SilentlyContinue
        $count = ($items | Where-Object { -not $_.PSIsContainer }).Count
        $bytes = ($items | Where-Object { -not $_.PSIsContainer } | Measure-Object -Property Length -Sum).Sum
        $size  = [math]::Round($bytes / 1MB, 2)
        $lblDetail.Text = "$count file  -  $size MB  -  $($listBox.SelectedItem)"
    } else {
        $lblDetail.Text = ""
    }
}
$listBox.Add_SelectedIndexChanged({ Update-Detail })
Update-Detail

$sep2 = New-Object System.Windows.Forms.Label
$sep2.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 80)
$sep2.Location  = New-Object System.Drawing.Point(20, 390)
$sep2.Size      = New-Object System.Drawing.Size(510, 1)
$form.Controls.Add($sep2)

# ── Tasto RIPRISTINA ──
$btnRestore = New-Object System.Windows.Forms.Button
$btnRestore.Text      = "RIPRISTINA"
$btnRestore.Font      = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnRestore.BackColor = [System.Drawing.Color]::FromArgb(50, 140, 240)
$btnRestore.ForeColor = [System.Drawing.Color]::White
$btnRestore.FlatStyle = "Flat"
$btnRestore.Location  = New-Object System.Drawing.Point(20, 405)
$btnRestore.Size      = New-Object System.Drawing.Size(155, 42)
$btnRestore.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnRestore)

# ── Tasto ELIMINA ──
$btnDelete = New-Object System.Windows.Forms.Button
$btnDelete.Text      = "ELIMINA"
$btnDelete.Font      = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnDelete.BackColor = [System.Drawing.Color]::FromArgb(200, 60, 60)
$btnDelete.ForeColor = [System.Drawing.Color]::White
$btnDelete.FlatStyle = "Flat"
$btnDelete.Location  = New-Object System.Drawing.Point(185, 405)
$btnDelete.Size      = New-Object System.Drawing.Size(155, 42)
$btnDelete.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnDelete)

# ── Tasto APRI CARTELLA ──
$btnOpen = New-Object System.Windows.Forms.Button
$btnOpen.Text      = "Apri Cartella"
$btnOpen.Font      = New-Object System.Drawing.Font("Segoe UI", 10)
$btnOpen.BackColor = [System.Drawing.Color]::FromArgb(60, 60, 80)
$btnOpen.ForeColor = [System.Drawing.Color]::White
$btnOpen.FlatStyle = "Flat"
$btnOpen.Location  = New-Object System.Drawing.Point(350, 405)
$btnOpen.Size      = New-Object System.Drawing.Size(180, 42)
$btnOpen.FlatAppearance.BorderSize = 0
$btnOpen.Add_Click({ Start-Process explorer.exe $backupsDir })
$form.Controls.Add($btnOpen)

# ── Azioni ──────────────────────────────────────────────────────────────────
$btnRestore.Add_Click({
    if (-not $listBox.SelectedItem) {
        [System.Windows.Forms.MessageBox]::Show("Seleziona un backup.", "Attenzione", "OK", "Warning"); return
    }
    $chosen  = $listBox.SelectedItem
    $confirm = [System.Windows.Forms.MessageBox]::Show(
        "Stai per ripristinare:`n`n  $chosen`n`nI file attuali verranno sovrascritti. Continuare?",
        "Conferma Ripristino",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    if ($confirm -ne "Yes") { return }
    $sourcePath = Join-Path $backupsDir $chosen
    $btnRestore.Enabled = $false; $btnDelete.Enabled = $false; $btnOpen.Enabled = $false
    $lblDetail.Text = "Ripristino in corso..."
    try {
        $files = Get-ChildItem $sourcePath -Recurse -File
        foreach ($file in $files) {
            $rel     = $file.FullName.Substring($sourcePath.Length + 1)
            $dest    = Join-Path $projectRoot $rel
            $destDir = Split-Path $dest
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item -Path $file.FullName -Destination $dest -Force
        }
        [System.Windows.Forms.MessageBox]::Show("Ripristino completato!`n$($files.Count) file ripristinati da:`n$chosen", "Fatto", "OK", [System.Windows.Forms.MessageBoxIcon]::Information)
        $form.Close()
    } catch {
        [System.Windows.Forms.MessageBox]::Show("Errore:`n$_", "Errore", "OK", "Error")
        $btnRestore.Enabled = $true; $btnDelete.Enabled = $true; $btnOpen.Enabled = $true
        Update-Detail
    }
})

$btnDelete.Add_Click({
    if (-not $listBox.SelectedItem) {
        [System.Windows.Forms.MessageBox]::Show("Seleziona un backup da eliminare.", "Attenzione", "OK", "Warning"); return
    }
    $chosen  = $listBox.SelectedItem
    $confirm = [System.Windows.Forms.MessageBox]::Show(
        "Eliminare definitivamente il backup:`n`n  $chosen`n`nQuesta operazione non e' reversibile.",
        "Conferma Eliminazione",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    if ($confirm -ne "Yes") { return }
    $targetPath = Join-Path $backupsDir $chosen
    try {
        Remove-Item $targetPath -Recurse -Force
        Refresh-List
        Update-Detail
        $lblDetail.Text = "Backup eliminato: $chosen"
    } catch {
        [System.Windows.Forms.MessageBox]::Show("Errore durante l'eliminazione:`n$_", "Errore", "OK", "Error")
    }
})

$form.ShowDialog() | Out-Null