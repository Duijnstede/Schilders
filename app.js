// 1. Importeer de benodigde Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ------------------------------------------------------------------------
// PLAK JOUW GEKOPIEERDE FIREBASE CONFIG HIERONDER
const firebaseConfig = {
  apiKey: "AIzaSyC0eTtQOX50MqEHo5D0B5-yBPiAfrX3Lyk",
  authDomain: "urenregistratie-schilders.firebaseapp.com",
  projectId: "urenregistratie-schilders",
  storageBucket: "urenregistratie-schilders.firebasestorage.app",
  messagingSenderId: "885772883499",
  appId: "1:885772883499:web:bb21bcbf9854ff8cdc3c6e"
};
// --- ADMIN INSTELLING ---
// Vul hier exact het e-mailadres in dat jij als beheerder gaat gebruiken!
const ADMIN_EMAIL = "admin@duijnstede.nl"; 
// ------------------------------------------------------------------------
// Initialiseer Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let urenData = [];
let editingId = null;
let deleteIdPending = null; // Nieuw: Onthoudt welk uur we willen verwijderen

// --- BEVEILIGINGS FILTERS & HELPERS ---
function sanitizeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

function sanitizeCSV(str) {
    if (!str) return '';
    if (str.match(/^[=\+\-@\t\r\n]/)) {
        return "'" + str; 
    }
    return str;
}

function formatName(email) {
    if (!email) return '';
    let namePart = email.split('@')[0];
    return namePart.split('.').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
// ----------------------------

// --- MENU IN/UITKLAPPEN ---
window.toggleMenu = function(event) {
    if(event) event.stopPropagation(); 
    const menu = document.getElementById('dropdown-menu');
    menu.classList.toggle('hidden');
}

window.addEventListener('click', function(e) {
    const menu = document.getElementById('dropdown-menu');
    if (menu && !e.target.matches('.menu-btn')) {
        menu.classList.add('hidden');
    }
});

// --- TOAST MELDING FUNCTIE ---
window.showToast = function(message) {
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toast-message");
    toastMessage.innerText = message;
    toast.classList.add("show");
    setTimeout(function(){ 
        toast.classList.remove("show"); 
    }, 3000); 
}

// Datum weergave instellen
document.getElementById('current-date-display').innerText = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

// "Andere" logica radiobuttons
document.querySelectorAll('input[name="omschrijving"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const andereInput = document.getElementById('andere-tekst');
        if(this.id === 'radio-andere') {
            andereInput.classList.remove('hidden'); andereInput.required = true;
        } else {
            andereInput.classList.add('hidden'); andereInput.required = false;
        }
    });
});

// CHECK OF IEMAND IS INGELOGD (MET ADMIN CHECK)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        
        document.getElementById('user-display').innerText = sanitizeHTML(formatName(user.email));
        
        if (user.email === ADMIN_EMAIL) {
            document.getElementById('tab-btn-form').classList.add('hidden'); 
            document.getElementById('tab-btn-overview').innerText = "📅 Alle Uren van Schilders (Admin)";
            window.showTab('overview-tab'); 
        } else {
            document.getElementById('tab-btn-form').classList.remove('hidden');
            document.getElementById('tab-btn-overview').innerText = "📅 Mijn Overzicht (Mój przegląd)";
            window.showTab('form-tab');
        }
        
        haalUrenOp(); 
    } else {
        currentUser = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('hidden');
    }
});

// LOGIN FUNCTIE
window.login = async function() {
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        alert("Błąd logowania: Sprawdź adres e-mail i hasło. (Fout bij inloggen)");
    }
}

// UITLOGGEN
window.logout = function() {
    signOut(auth);
}

// TABS WISSELEN
window.showTab = function(tabId) {
    document.getElementById('form-tab').classList.add('hidden');
    document.getElementById('overview-tab').classList.add('hidden');
    document.getElementById(tabId).classList.remove('hidden');
    
    document.getElementById('tab-btn-form').classList.remove('active');
    document.getElementById('tab-btn-overview').classList.remove('active');
    
    if(tabId === 'form-tab') document.getElementById('tab-btn-form').classList.add('active');
    if(tabId === 'overview-tab') document.getElementById('tab-btn-overview').classList.add('active');
}

// IN- EN UITKLAPPEN VAN WEKEN
window.toggleWeek = function(weekKey) {
    const content = document.getElementById(`content-${weekKey}`);
    const icon = document.getElementById(`icon-${weekKey}`);
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = "rotate(0deg)";
    } else {
        content.classList.add('hidden');
        icon.style.transform = "rotate(-90deg)";
    }
}

// CONTROLEER WEEKEND
window.checkDatum = function() {
    const datumVal = document.getElementById('datum').value;
    if (!datumVal) return;
    const day = new Date(datumVal).getDay();
    if (day === 0 || day === 6) {
        document.getElementById('datum-error').classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    } else {
        document.getElementById('datum-error').classList.add('hidden');
        window.checkUren(); 
    }
}

// CONTROLEER MAX 8 UUR
window.checkUren = function() {
    const datum = document.getElementById('datum').value;
    const nieuweUren = parseFloat(document.getElementById('uren').value) || 0;
    if (!datum) return;

    const urenOpDatum = urenData
        .filter(item => item.datum === datum && item.id !== editingId)
        .reduce((totaal, item) => totaal + parseFloat(item.uren), 0);

    if (urenOpDatum + nieuweUren > 8) {
        document.getElementById('uren-error').classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    } else {
        document.getElementById('uren-error').classList.add('hidden');
        document.getElementById('submit-btn').disabled = false;
    }
}

// DATABASE: UREN OPHALEN
async function haalUrenOp() {
    if (!currentUser) return;
    urenData = [];
    
    let q;
    if (currentUser.email === ADMIN_EMAIL) {
        q = query(collection(db, "uren"));
    } else {
        q = query(collection(db, "uren"), where("userId", "==", currentUser.uid));
    }

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        urenData.push({ id: doc.id, ...doc.data() });
    });
    renderLijst();
}

// FORMULIER VERZENDEN NAAR DATABASE
document.getElementById('uren-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    document.getElementById('submit-btn').disabled = true; 
    document.getElementById('submit-btn').innerText = "Zapisywanie...";
    
    const datumVal = document.getElementById('datum').value;
    const dateObj = new Date(datumVal);
    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
        alert("W weekend nie można rejestrować godzin. (Weekenduren worden niet geaccepteerd.)");
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('submit-btn').innerText = "Opslaan (Zapisz)";
        return; 
    }

    let omschrijving = document.querySelector('input[name="omschrijving"]:checked').value;
    if (omschrijving === 'Andere') omschrijving = document.getElementById('andere-tekst').value;

    const invoerData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        datum: datumVal,
        uren: document.getElementById('uren').value,
        adres: document.getElementById('adres').value, 
        omschrijving: omschrijving, 
        timestamp: Date.now()
    };

    try {
        if (editingId) {
            await updateDoc(doc(db, "uren", editingId), invoerData);
            showToast("Pomyślnie zaktualizowano godziny! (Uren succesvol bijgewerkt!)");
        } else {
            await addDoc(collection(db, "uren"), invoerData);
            showToast("Pomyślnie zapisano godziny! (Uren succesvol opgeslagen!)");
        }
        await haalUrenOp(); 
        window.cancelEdit(); 
        window.showTab('overview-tab');
    } catch (error) {
        console.error("Fout bij opslaan:", error);
        alert("Błąd podczas zapisywania. (Er ging iets mis bij het opslaan.)");
    }
    
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('submit-btn').innerText = "Opslaan (Zapisz)";
});

// HELPER: ISO WEEK NUMMER
function getWeekInfo(dateString) {
    const d = new Date(dateString);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return { year: d.getFullYear(), week: weekNum };
}

const dagenNamen = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

// LIJST TONEN
function renderLijst() {
    const lijst = document.getElementById('uren-lijst');
    lijst.innerHTML = '';
    
    if(urenData.length === 0) {
        lijst.innerHTML = '<div class="card"><p>Brak zarejestrowanych godzin. (Nog geen uren geregistreerd.)</p></div>'; return;
    }

    const poolseVertalingen = {
        "Schilderwerkzaamheden": "Schilderwerkzaamheden (Prace malarskie)",
        "Sloopwerkzaamheden": "Sloopwerkzaamheden (Prace rozbiórkowe)",
        "Zieke dag": "Zieke dag (Dzień choroby)",
        "Vrije dag": "Vrije dag (Dzień wolny)",
        "Vakantie": "Vakantie (Wakacje)"
    };

    const grouped = {};
    urenData.forEach(item => {
        const weekInfo = getWeekInfo(item.datum);
        const key = `${weekInfo.year}-W${weekInfo.week.toString().padStart(2, '0')}`;
        if(!grouped[key]) grouped[key] = { items: [], totals: { 1:0, 2:0, 3:0, 4:0, 5:0 } };
        grouped[key].items.push(item);
        
        const dayOfWeek = new Date(item.datum).getDay();
        if(dayOfWeek >= 1 && dayOfWeek <= 5) {
            grouped[key].totals[dayOfWeek] += parseFloat(item.uren);
        }
    });

    Object.keys(grouped).sort().reverse().forEach((key, index) => {
        const weekNum = key.split('-W')[1];
        const group = grouped[key];
        
        group.items.sort((a, b) => new Date(a.datum) - new Date(b.datum));
        
        const weekDiv = document.createElement('div');
        weekDiv.className = 'week-container';
        
        let totalsHTML = '';
        for(let i = 1; i <= 5; i++) {
            if(group.totals[i] > 0) totalsHTML += `<span class="day-stat">${dagenNamen[i]}: ${group.totals[i]}u</span>`;
        }

        const isHidden = index === 0 ? '' : 'hidden';
        const rotation = index === 0 ? '0deg' : '-90deg';

        let html = `
            <div class="week-header" onclick="toggleWeek('${key}')" style="cursor: pointer; user-select: none;">
                <h3 style="display: flex; align-items: center;">
                    <span id="icon-${key}" style="font-size: 14px; margin-right: 8px; transition: transform 0.2s; transform: rotate(${rotation});">▼</span> 
                    Week ${weekNum}
                </h3>
                <span class="badge" style="background: rgba(255,255,255,0.2); color: white;">Totaal: ${group.items.reduce((sum, i) => sum + parseFloat(i.uren), 0)} uur</span>
            </div>
            
            <div id="content-${key}" class="${isHidden}">
                <div class="week-summary">${totalsHTML}</div>
        `;

        group.items.forEach(item => {
            const datumNL = new Date(item.datum).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
            
            const veiligAdres = sanitizeHTML(item.adres);
            let veiligeOmschrijving = sanitizeHTML(item.omschrijving);
            const mooieNaam = sanitizeHTML(formatName(item.userEmail));

            if (poolseVertalingen[veiligeOmschrijving]) {
                veiligeOmschrijving = poolseVertalingen[veiligeOmschrijving];
            }

            html += `
                <div class="uren-card">
                    <div class="uren-card-header">
                        <strong>${datumNL}</strong>
                        <div class="action-buttons">
                            <button class="btn-icon" onclick="editUren('${item.id}')" title="Bewerken (Edytuj)">✏️</button>
                            <button class="btn-icon btn-delete" onclick="verwijderUren('${item.id}')" title="Verwijderen (Usuń)">🗑️</button>
                        </div>
                    </div>
                    <div>
                        <span class="badge">${item.uren} uur (godz)</span> - <strong>${veiligeOmschrijving}</strong><br>
                        <span style="color: #6c757d; font-size: 14px;">📍 ${veiligAdres}</span><br>
                        <span style="color: #0056b3; font-size: 13px; font-weight: 600; margin-top: 5px; display: inline-block;">👤 ${mooieNaam}</span>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`; 
        
        weekDiv.innerHTML = html;
        lijst.appendChild(weekDiv);
    });
}

// BEWERKEN
window.editUren = function(id) {
    const item = urenData.find(u => u.id === id);
    if(!item) return;
    
    editingId = id;
    document.getElementById('form-title').innerText = "Uren bewerken (Edytuj godziny)";
    document.getElementById('datum').value = item.datum;
    document.getElementById('uren').value = item.uren;
    document.getElementById('adres').value = item.adres;
    
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

    document.getElementById('submit-btn').innerText = "Opslaan (Zapisz)";
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    
    window.showTab('form-tab');
    window.checkUren(); 
}

window.cancelEdit = function() {
    editingId = null;
    document.getElementById('uren-form').reset();
    document.getElementById('form-title').innerText = "Uren invullen (Wprowadź godziny)";
    document.getElementById('submit-btn').innerText = "Opslaan (Zapisz)";
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('andere-tekst').classList.add('hidden');
}


// --- NIEUWE VERWIJDER POP-UP FUNCTIES ---

// 1. Pop-up openen
window.verwijderUren = function(id) {
    deleteIdPending = id; // Sla op welk uur de gebruiker wil verwijderen
    document.getElementById('confirm-modal').classList.remove('hidden');
}

// 2. Pop-up sluiten (Annuleren)
window.closeConfirmModal = function() {
    deleteIdPending = null;
    document.getElementById('confirm-modal').classList.add('hidden');
}

// 3. Definitief verwijderen
window.executeDelete = async function() {
    if(!deleteIdPending) return;
    const id = deleteIdPending;
    window.closeConfirmModal(); // Verberg de pop-up direct

    try {
        await deleteDoc(doc(db, "uren", id));
        await haalUrenOp();
        if(editingId === id) window.cancelEdit();
        showToast("Godziny usunięte! (Uren succesvol verwijderd!)");
    } catch (error) {
        alert("Błąd podczas usuwania. (Fout bij verwijderen.)");
    }
}
// ----------------------------------------

// EXPORTEREN 
window.exportToCSV = function() {
    if(urenData.length === 0) { alert("Brak danych (Geen data)."); return; }
    let csvContent = "data:text/csv;charset=utf-8,Schilder,Datum,Uren,Adres,Omschrijving\n";
    urenData.forEach(row => {
        const mooieNaam = sanitizeCSV(formatName(row.userEmail));
        const safeAdres = sanitizeCSV(row.adres).replace(/"/g, '""'); 
        const safeOmschrijving = sanitizeCSV(row.omschrijving).replace(/"/g, '""');
        csvContent += `${mooieNaam},${row.datum},${row.uren},"${safeAdres}","${safeOmschrijving}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "urenregistratie.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
