Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$projectRoot = "i:\Il mio Drive\drive\Antigravity\Preventivi\Preventivi_v2.5"
$backupsDir  = Join-Path $projectRoot "Manual_Backups"

# ── Form ─────────────────────────────────────────────────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text            = "Crea Backup - Preventivi v2.5"
$form.Size            = New-Object System.Drawing.Size(500, 340)
$form.StartPosition   = "CenterScreen"
$form.BackColor       = [System.Drawing.Color]::FromArgb(18, 18, 30)
$form.ForeColor       = [System.Drawing.Color]::White
$form.Font            = New-Object System.Drawing.Font("Segoe UI", 10)
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox     = $false

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text      = "Crea un nuovo backup del progetto"
$lblTitle.Font      = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$lblTitle.ForeColor = [System.Drawing.Color]::FromArgb(100, 220, 140)
$lblTitle.Location  = New-Object System.Drawing.Point(20, 20)
$lblTitle.Size      = New-Object System.Drawing.Size(450, 30)
$form.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text      = "Verranno esclusi: node_modules, __DEPLOY_ME__, .netlify, Manual_Backups"
$lblSub.ForeColor = [System.Drawing.Color]::FromArgb(150, 150, 170)
$lblSub.Location  = New-Object System.Drawing.Point(20, 55)
$lblSub.Size      = New-Object System.Drawing.Size(450, 20)
$form.Controls.Add($lblSub)

$sep = New-Object System.Windows.Forms.Label
$sep.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 80)
$sep.Location  = New-Object System.Drawing.Point(20, 83)
$sep.Size      = New-Object System.Drawing.Size(450, 1)
$form.Controls.Add($sep)

# Label nome backup
$lblNome = New-Object System.Windows.Forms.Label
$lblNome.Text      = "Nome backup:"
$lblNome.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 200)
$lblNome.Location  = New-Object System.Drawing.Point(20, 100)
$lblNome.Size      = New-Object System.Drawing.Size(100, 22)
$form.Controls.Add($lblNome)

$timestamp = Get-Date -Format "yyyy-MM-dd__HH_mm_ss"
$txtNome = New-Object System.Windows.Forms.TextBox
$txtNome.Text      = "Backup_$timestamp"
$txtNome.Location  = New-Object System.Drawing.Point(125, 98)
$txtNome.Size      = New-Object System.Drawing.Size(345, 24)
$txtNome.BackColor = [System.Drawing.Color]::FromArgb(35, 35, 55)
$txtNome.ForeColor = [System.Drawing.Color]::White
$txtNome.BorderStyle = "FixedSingle"
$form.Controls.Add($txtNome)

# Backup esistenti
$lblEsistenti = New-Object System.Windows.Forms.Label
$lblEsistenti.Text      = "Backup esistenti:"
$lblEsistenti.ForeColor = [System.Drawing.Color]::FromArgb(180, 180, 200)
$lblEsistenti.Location  = New-Object System.Drawing.Point(20, 135)
$lblEsistenti.Size      = New-Object System.Drawing.Size(450, 20)
$form.Controls.Add($lblEsistenti)

$listExisting = New-Object System.Windows.Forms.ListBox
$listExisting.Location    = New-Object System.Drawing.Point(20, 157)
$listExisting.Size        = New-Object System.Drawing.Size(450, 90)
$listExisting.BackColor   = [System.Drawing.Color]::FromArgb(28, 28, 45)
$listExisting.ForeColor   = [System.Drawing.Color]::FromArgb(160, 160, 180)
$listExisting.Font        = New-Object System.Drawing.Font("Consolas", 9)
$listExisting.BorderStyle = "FixedSingle"
$form.Controls.Add($listExisting)

$existing = Get-ChildItem -Path $backupsDir | Sort-Object Name -Descending
foreach ($e in $existing) { $listExisting.Items.Add($e.Name) | Out-Null }

# Status label
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Text      = "Pronto."
$lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(100, 200, 120)
$lblStatus.Location  = New-Object System.Drawing.Point(20, 258)
$lblStatus.Size      = New-Object System.Drawing.Size(450, 20)
$form.Controls.Add($lblStatus)

$sep2 = New-Object System.Windows.Forms.Label
$sep2.BackColor = [System.Drawing.Color]::FromArgb(50, 50, 80)
$sep2.Location  = New-Object System.Drawing.Point(20, 255)
$sep2.Size      = New-Object System.Drawing.Size(450, 1)
$form.Controls.Add($sep2)

$btnBackup = New-Object System.Windows.Forms.Button
$btnBackup.Text      = "CREA BACKUP"
$btnBackup.Font      = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnBackup.BackColor = [System.Drawing.Color]::FromArgb(40, 160, 80)
$btnBackup.ForeColor = [System.Drawing.Color]::White
$btnBackup.FlatStyle = "Flat"
$btnBackup.Location  = New-Object System.Drawing.Point(20, 270)
$btnBackup.Size      = New-Object System.Drawing.Size(210, 42)
$btnBackup.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnBackup)

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text      = "Chiudi"
$btnCancel.Font      = New-Object System.Drawing.Font("Segoe UI", 11)
$btnCancel.BackColor = [System.Drawing.Color]::FromArgb(60, 60, 80)
$btnCancel.ForeColor = [System.Drawing.Color]::White
$btnCancel.FlatStyle = "Flat"
$btnCancel.Location  = New-Object System.Drawing.Point(260, 270)
$btnCancel.Size      = New-Object System.Drawing.Size(210, 42)
$btnCancel.FlatAppearance.BorderSize = 0
$btnCancel.Add_Click({ $form.Close() })
$form.Controls.Add($btnCancel)

$btnBackup.Add_Click({
    $nome = $txtNome.Text.Trim()
    if ([string]::IsNullOrEmpty($nome)) {
        [System.Windows.Forms.MessageBox]::Show("Inserisci un nome per il backup.", "Attenzione", "OK", "Warning")
        return
    }
    $destPath = Join-Path $backupsDir $nome
    if (Test-Path $destPath) {
        $r = [System.Windows.Forms.MessageBox]::Show("Esiste gia' un backup con questo nome. Sovrascrivere?", "Conferma", "YesNo", "Warning")
        if ($r -ne "Yes") { return }
        Remove-Item $destPath -Recurse -Force
    }

    $btnBackup.Enabled = $false
    $btnCancel.Enabled = $false
    $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(255, 200, 60)
    $lblStatus.Text = "Backup in corso..."
    $form.Refresh()

    try {
        New-Item -ItemType Directory -Path $destPath | Out-Null
        $excludeDirs = @("node_modules", ".netlify", "__DEPLOY_ME__", "Manual_Backups")
        $files = Get-ChildItem -Path $projectRoot -Recurse | Where-Object {
            $item = $_
            $skip = $false
            foreach ($ex in $excludeDirs) {
                if ($item.FullName -like "*\$ex\*" -or $item.FullName -eq (Join-Path $projectRoot $ex)) { $skip = $true; break }
            }
            -not $skip -and -not $item.PSIsContainer
        }
        foreach ($file in $files) {
            $rel     = $file.FullName.Substring($projectRoot.Length + 1)
            $dest    = Join-Path $destPath $rel
            $destDir = Split-Path $dest
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item -Path $file.FullName -Destination $dest -Force
        }

        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(100, 220, 140)
        $lblStatus.Text = "Backup completato: $($files.Count) file salvati."
        $listExisting.Items.Clear()
        $ex2 = Get-ChildItem -Path $backupsDir | Sort-Object Name -Descending
        foreach ($e in $ex2) { $listExisting.Items.Add($e.Name) | Out-Null }
        $txtNome.Text = "Backup_" + (Get-Date -Format "yyyy-MM-dd__HH_mm_ss")
    } catch {
        $lblStatus.ForeColor = [System.Drawing.Color]::FromArgb(240, 80, 80)
        $lblStatus.Text = "Errore: $_"
    }

    $btnBackup.Enabled = $true
    $btnCancel.Enabled = $true
})

$form.ShowDialog() | Out-Null