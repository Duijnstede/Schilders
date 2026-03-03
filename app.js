let urenData = JSON.parse(localStorage.getItem('urenData')) || [];
let currentUser = null;
let editingId = null; // Houdt bij of we een bestaande entry bewerken

// Toon huidige datum
document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

// "Andere" logica
document.querySelectorAll('input[name="omschrijving"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const andereInput = document.getElementById('andere-tekst');
        if(this.id === 'radio-andere') {
            andereInput.classList.remove('hidden');
            andereInput.required = true;
        } else {
            andereInput.classList.add('hidden');
            andereInput.required = false;
        }
    });
});

// INLOGGEN
function login() {
    const user = document.getElementById('username').value;
    if (user) { 
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('user-display').innerText = user;
        renderLijst();
    }
}

function logout() {
    currentUser = null;
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
}

// TABS WISSELEN
function showTab(tabId) {
    document.getElementById('form-tab').classList.add('hidden');
    document.getElementById('overview-tab').classList.add('hidden');
    document.getElementById(tabId).classList.remove('hidden');
    
    document.getElementById('tab-btn-form').classList.remove('active');
    document.getElementById('tab-btn-overview').classList.remove('active');
    
    if(tabId === 'form-tab') document.getElementById('tab-btn-form').classList.add('active');
    if(tabId === 'overview-tab') document.getElementById('tab-btn-overview').classList.add('active');
}

// CONTROLEER WEEKEND (Visueel)
function checkDatum() {
    const datumVal = document.getElementById('datum').value;
    if (!datumVal) return;
    const dateObj = new Date(datumVal);
    const day = dateObj.getDay();
    
    if (day === 0 || day === 6) {
        document.getElementById('datum-error').classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    } else {
        document.getElementById('datum-error').classList.add('hidden');
        checkUren(); 
    }
}

// CONTROLEER MAX 8 UUR PER DAG
function checkUren() {
    const datum = document.getElementById('datum').value;
    const nieuweUren = parseFloat(document.getElementById('uren').value) || 0;
    if (!datum) return;

    const urenOpDatum = urenData
        .filter(item => item.user === currentUser && item.datum === datum && item.id !== editingId)
        .reduce((totaal, item) => totaal + parseFloat(item.uren), 0);

    if (urenOpDatum + nieuweUren > 8) {
        document.getElementById('uren-error').classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    } else {
        document.getElementById('uren-error').classList.add('hidden');
        document.getElementById('submit-btn').disabled = false;
    }
}

// FORMULIER VERZENDEN & KEIHARDE WEEKEND CHECK
document.getElementById('uren-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const controle = document.querySelector('input[name="controle"]:checked').value;
    if(controle === 'Nee') {
        alert("Pas uw antwoorden aan voordat u verzendt."); return;
    }

    // KEIHARDE BACKEND-STIJL CONTROLE OP WEEKEND
    const datumVal = document.getElementById('datum').value;
    const dateObj = new Date(datumVal);
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
        alert("Systeemfout: Weekenduren worden onder geen enkele voorwaarde geaccepteerd.");
        return; // Breekt het opslaan af
    }

    let omschrijving = document.querySelector('input[name="omschrijving"]:checked').value;
    if (omschrijving === 'Andere') omschrijving = document.getElementById('andere-tekst').value;

    const invoerData = {
        id: editingId ? editingId : Date.now(),
        user: currentUser,
        datum: datumVal,
        uren: document.getElementById('uren').value,
        adres: document.getElementById('adres').value,
        omschrijving: omschrijving
    };

    if (editingId) {
        // Update bestaande rij
        const index = urenData.findIndex(u => u.id === editingId);
        urenData[index] = invoerData;
        alert("Uren succesvol bijgewerkt!");
    } else {
        // Nieuwe rij
        urenData.push(invoerData);
        alert("Uren succesvol opgeslagen!");
    }

    localStorage.setItem('urenData', JSON.stringify(urenData));
    cancelEdit(); // Reset formulier status
    renderLijst();
    showTab('overview-tab');
});

// HELPER: ISO WEEK NUMMER BEREKENEN
function getWeekInfo(dateString) {
    const d = new Date(dateString);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return { year: d.getFullYear(), week: weekNum };
}

const dagenNamen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

// LIJST TONEN (Gegroepeerd per week)
function renderLijst() {
    const lijst = document.getElementById('uren-lijst');
    lijst.innerHTML = '';
    
    let userUren = urenData.filter(item => item.user === currentUser);
    userUren.sort((a,b) => new Date(b.datum) - new Date(a.datum)); // Nieuwste eerst
    
    if(userUren.length === 0) {
        lijst.innerHTML = '<div class="card"><p>Nog geen uren geregistreerd.</p></div>'; return;
    }

    // Groeperen per jaar-week
    const grouped = {};
    userUren.forEach(item => {
        const weekInfo = getWeekInfo(item.datum);
        const key = `${weekInfo.year}-W${weekInfo.week.toString().padStart(2, '0')}`;
        if(!grouped[key]) grouped[key] = { items: [], totals: { 1:0, 2:0, 3:0, 4:0, 5:0 } };
        grouped[key].items.push(item);
        
        const dayOfWeek = new Date(item.datum).getDay();
        if(dayOfWeek >= 1 && dayOfWeek <= 5) {
            grouped[key].totals[dayOfWeek] += parseFloat(item.uren);
        }
    });

    // Render Groepen
    Object.keys(grouped).sort().reverse().forEach(key => {
        const weekNum = key.split('-W')[1];
        const group = grouped[key];
        
        const weekDiv = document.createElement('div');
        weekDiv.className = 'week-container';
        
        // Dag totalen string maken
        let totalsHTML = '';
        for(let i = 1; i <= 5; i++) {
            if(group.totals[i] > 0) {
                totalsHTML += `<span class="day-stat">${dagenNamen[i]}: ${group.totals[i]}u</span>`;
            }
        }

        let html = `
            <div class="week-header">
                <h3>Week ${weekNum}</h3>
                <span class="badge" style="background: rgba(255,255,255,0.2); color: white;">Totaal: ${group.items.reduce((sum, i) => sum + parseFloat(i.uren), 0)} uur</span>
            </div>
            <div class="week-summary">
                ${totalsHTML}
            </div>
        `;

        group.items.forEach(item => {
            const datumNL = new Date(item.datum).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
            html += `
                <div class="uren-card">
                    <div class="uren-card-header">
                        <strong>${datumNL}</strong>
                        <div class="action-buttons">
                            <button class="btn-icon" onclick="editUren(${item.id})" title="Bewerken">✏️</button>
                            <button class="btn-icon btn-delete" onclick="verwijderUren(${item.id})" title="Verwijderen">🗑️</button>
                        </div>
                    </div>
                    <div>
                        <span class="badge">${item.uren} uur</span> - <strong>${item.omschrijving}</strong><br>
                        <span style="color: var(--text-muted); font-size: 14px;">📍 ${item.adres}</span>
                    </div>
                </div>
            `;
        });
        
        weekDiv.innerHTML = html;
        lijst.appendChild(weekDiv);
    });
}

// BEWERKEN VAN UREN
function editUren(id) {
    const item = urenData.find(u => u.id === id);
    if(!item) return;
    
    editingId = id;
    document.getElementById('form-title').innerText = "Uren bewerken";
    document.getElementById('datum').value = item.datum;
    document.getElementById('uren').value = item.uren;
    document.getElementById('adres').value = item.adres;
    
    // Selecteer juiste radio button
    const radios = document.getElementsByName('omschrijving');
    let found = false;
    for(let r of radios) {
        if(r.value === item.omschrijving) {
            r.checked = true; found = true;
            document.getElementById('andere-tekst').classList.add('hidden');
        }
    }
    if(!found) {
        document.getElementById('radio-andere').checked = true;
        document.getElementById('andere-tekst').value = item.omschrijving;
        document.getElementById('andere-tekst').classList.remove('hidden');
    }

    document.getElementById('submit-btn').innerText = "Opslaan (Bewerken)";
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    
    showTab('form-tab');
    checkUren(); // Her-evalueer uren blokkade (negeert nu zichzelf)
}

function cancelEdit() {
    editingId = null;
    document.getElementById('uren-form').reset();
    document.getElementById('form-title').innerText = "Uren invullen";
    document.getElementById('submit-btn').innerText = "Verzenden";
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('andere-tekst').classList.add('hidden');
}

function verwijderUren(id) {
    if(confirm("Weet je zeker dat je deze uren wilt verwijderen?")) {
        urenData = urenData.filter(item => item.id !== id);
        localStorage.setItem('urenData', JSON.stringify(urenData));
        renderLijst();
        if(editingId === id) cancelEdit();
    }
}

// EXPORTEREN
function exportToCSV() {
    if(urenData.length === 0) { alert("Geen data."); return; }
    let csvContent = "data:text/csv;charset=utf-8,Schilder,Datum,Uren,Adres,Omschrijving\n";
    urenData.forEach(row => {
        csvContent += `${row.user},${row.datum},${row.uren},"${row.adres}","${row.omschrijving}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "urenregistratie.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
