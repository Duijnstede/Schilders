// TIJDELIJKE DATABASE (voor testen op GitHub Pages)
let urenData = JSON.parse(localStorage.getItem('urenData')) || [];
let currentUser = null;

// Toon extra veld bij "Andere"
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

// SIMPELE LOGIN
function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if (user && pass) { // Accepteert voor het testen alles zolang er iets is ingevuld
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('user-display').innerText = user;
        renderLijst();
    } else {
        alert("Vul gebruikersnaam en wachtwoord in.");
    }
}

function logout() {
    currentUser = null;
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// TABS WISSELEN
function showTab(tabId) {
    document.getElementById('form-tab').classList.add('hidden');
    document.getElementById('overview-tab').classList.add('hidden');
    document.getElementById(tabId).classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// CONTROLEER WEEKEND
function checkDatum() {
    const datumVal = document.getElementById('datum').value;
    if (!datumVal) return;
    const dateObj = new Date(datumVal);
    const day = dateObj.getDay(); // 0 = Zondag, 6 = Zaterdag
    
    if (day === 0 || day === 6) {
        document.getElementById('datum-error').classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    } else {
        document.getElementById('datum-error').classList.add('hidden');
        checkUren(); // Her-evalueer uren als de datum goed is
    }
}

// CONTROLEER MAX 8 UUR PER DAG
function checkUren() {
    const datum = document.getElementById('datum').value;
    const nieuweUren = parseFloat(document.getElementById('uren').value) || 0;
    
    if (!datum) return;

    // Bereken hoeveel uur deze gebruiker al op deze datum heeft
    const urenOpDatum = urenData
        .filter(item => item.user === currentUser && item.datum === datum)
        .reduce((totaal, item) => totaal + parseFloat(item.uren), 0);

    if (urenOpDatum + nieuweUren > 8) {
        document.getElementById('uren-error').classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    } else {
        document.getElementById('uren-error').classList.add('hidden');
        document.getElementById('submit-btn').disabled = false;
    }
}

// FORMULIER VERZENDEN
document.getElementById('uren-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Check extra controle vraag
    const controle = document.querySelector('input[name="controle"]:checked').value;
    if(controle === 'Nee') {
        alert("Pas uw antwoorden aan voordat u verzendt.");
        return;
    }

    let omschrijving = document.querySelector('input[name="omschrijving"]:checked').value;
    if (omschrijving === 'Andere') {
        omschrijving = document.getElementById('andere-tekst').value;
    }

    const nieuweInvoer = {
        id: Date.now(),
        user: currentUser,
        datum: document.getElementById('datum').value,
        uren: document.getElementById('uren').value,
        adres: document.getElementById('adres').value,
        omschrijving: omschrijving
    };

    urenData.push(nieuweInvoer);
    localStorage.setItem('urenData', JSON.stringify(urenData));
    
    alert("Uren succesvol opgeslagen!");
    this.reset();
    document.getElementById('andere-tekst').classList.add('hidden');
    renderLijst();
    showTab('overview-tab');
});

// LIJST TONEN (Alleen voor de ingelogde gebruiker)
function renderLijst() {
    const lijst = document.getElementById('uren-lijst');
    lijst.innerHTML = '';
    
    const userUren = urenData.filter(item => item.user === currentUser).sort((a,b) => new Date(b.datum) - new Date(a.datum));
    
    if(userUren.length === 0) {
        lijst.innerHTML = '<p>Nog geen uren geregistreerd.</p>';
        return;
    }

    userUren.forEach(item => {
        const div = document.createElement('div');
        div.className = 'uren-card';
        div.innerHTML = `
            <strong>${item.datum}</strong> - ${item.uren} uur<br>
            <em>Adres:</em> ${item.adres}<br>
            <em>Werk:</em> ${item.omschrijving}
            <button class="delete-btn" onclick="verwijderUren(${item.id})">Verwijder</button>
        `;
        lijst.appendChild(div);
    });
}

function verwijderUren(id) {
    if(confirm("Weet je zeker dat je deze uren wilt verwijderen?")) {
        urenData = urenData.filter(item => item.id !== id);
        localStorage.setItem('urenData', JSON.stringify(urenData));
        renderLijst();
        checkUren(); // Update de blokkade mocht hij op de tab formulier staan
    }
}

// EXPORTEREN NAAR EXCEL (CSV)
function exportToCSV() {
    // Haal alle uren op (of als je wilt dat schilders alleen eigen uren exporteren, gebruik userUren)
    if(urenData.length === 0) {
        alert("Er is geen data om te exporteren.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Schilder,Datum,Uren,Adres,Omschrijving\n"; // Headers

    urenData.forEach(row => {
        // Zorg dat komma's in de tekst de CSV niet breken
        let adresSafe = `"${row.adres}"`; 
        let rowData = `${row.user},${row.datum},${row.uren},${adresSafe},"${row.omschrijving}"`;
        csvContent += rowData + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "urenregistratie.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
