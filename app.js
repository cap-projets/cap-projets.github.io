/* =====================================================================
   Cap Projets (sorties, voyages et événements) – Protectorat Saint-Joseph
   Pages de l'outil, reliées à Supabase.
   Les réglages (adresse du projet, clé publique) sont dans config.js.
   ===================================================================== */
"use strict";

const DOMAIN = (window.CONFIG && window.CONFIG.domaine) || "protectorat.fr";
const BUCKET = "pieces-jointes";
const TAILLE_MAX = 10 * 1024 * 1024;
const ETAB = {
  nom: "Protectorat Saint-Joseph",
  statut: "Établissement scolaire catholique privé sous contrat",
  adresse: "36 rue Jacques Duclos, 93600 Aulnay-sous-Bois",
  tel: "01 48 66 10 41",
  mail: "administration@protectorat.fr",
  horaires: "du lundi au vendredi, de 8 h à 18 h",
  site: "https://www.protectorat.net/"
};
const UNITES = {
  college: { label: "Collège" },
  lycee: { label: "Lycée", hint: "Professionnel et technologique" },
  sup: { label: "Pôle supérieur", hint: "BTS et licence" }
};
const SERVICES = {
  compta: { label: "Comptabilité", task: "Facturation aux familles et échéancier" },
  viesco: { label: "Vie scolaire", task: "Emploi du temps réorganisé, absences signalées" },
  secretariat: { label: "Secrétariat", task: "Ordres de mission édités" },
  cuisine: { label: "Chef de cuisine", task: "Paniers repas prévus" },
  technique: { label: "Service technique", task: "Préparation du lieu et du matériel" }
};
const BESOINS_TECH = [["projection", "Projection", "vidéoprojecteur, écran"], ["sonorisation", "Sonorisation", "micros, enceintes"], ["amenagement", "Aménagement du lieu", "chaises, tables, espace scénique"]];
const STATUS = {
  brouillon: { label: "Brouillon", cls: "draft-c" },
  soumise: { label: "En attente de décision", cls: "warn-c" },
  complements: { label: "Compléments demandés", cls: "info-c" },
  validee: { label: "Validée", cls: "ok-c" },
  refusee: { label: "Refusée", cls: "bad-c" }
};
const QUALITES = { enseignant: "Enseignant", personnel: "Personnel de l’établissement", aesh: "AESH", parent: "Parent d’élève", autre: "Autre bénévole" };
const TRANSPORTS = ["À pied", "Transports en commun", "Car", "Train", "Avion"];
function autresTransports(x) { return (x.transports || []).filter(t => !TRANSPORTS.includes(t)); }
const DEPENSES = [["transport", "Transport"], ["activites", "Entrées, visites, activités"], ["hebergement", "Hébergement"], ["prestation", "Prestation de l’intervenant"], ["restauration", "Restauration"], ["autre", "Autre dépense"]];
// Dépenses proposées selon le type de projet.
const DEP_TYPES = { transport: ["sortie", "voyage"], activites: ["sortie", "voyage"], hebergement: ["voyage"], prestation: ["etablissement"] };
const depVisible = (k, type) => !DEP_TYPES[k] || DEP_TYPES[k].includes(type);
const TYPES = {
  sortie: { label: "Sortie", hint: "Sans nuitée", chip: "Sortie sans nuitée", court: "sortie" },
  voyage: { label: "Voyage", hint: "Avec nuitées", chip: "Voyage avec nuitées", court: "voyage" },
  etablissement: { label: "Événement dans l’établissement", hint: "Spectacle, intervenant, atelier… dans nos locaux", chip: "Dans l’établissement", court: "événement" }
};
const interne = r => r.type === "etablissement";
const FIN = [["familles", "Familles"], ["budgetPeda", "Budget pédagogique"], ["taxe", "Taxe d’apprentissage"], ["apel", "APEL"], ["autreFin", "Autre"]];

/* ---------- Outils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function num(v) { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : 0; }
function eur(n) { return (Math.round((n || 0) * 100) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); }
function d(iso) { return new Date(iso + "T12:00:00"); }
function dShort(iso) { return iso ? d(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "date à préciser"; }
function dLong(iso) { return iso ? d(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "date à préciser"; }
function dateRange(r) {
  if (!r.dateDebut) return "date à préciser";
  if (r.type === "voyage" && r.dateFin && r.dateFin !== r.dateDebut) return "du " + dShort(r.dateDebut) + " au " + dShort(r.dateFin);
  return dShort(r.dateDebut);
}
function stamp(ts) { return ts ? new Date(ts).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; }
function daysUntil(iso) { if (!iso) return Infinity; const t = new Date(); t.setHours(12, 0, 0, 0); return Math.round((d(iso) - t) / 86400000); }
function plural(n, s, p) { return n + " " + (n > 1 ? (p || s + "s") : s); }
function encadrement(a, n) { return a === 1 ? "1 adulte pour " + plural(n, "élève") : a + " adultes pour " + plural(n, "élève") + ", soit 1 adulte pour " + Math.ceil(n / a) + " élèves"; }
function cap(w) { return w.split("-").map(p => p ? p[0].toUpperCase() + p.slice(1) : p).join("-"); }
function initials(name) { const w = name.replace(/^(M\.|Mme|Mlle)\s+/, "").split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || "?").slice(0, 2)).toUpperCase(); }
function nameFromEmail(email) {
  const parts = String(email).split("@")[0].split(".").filter(Boolean);
  if (parts.length < 2) return cap(parts[0] || "Personnel");
  return cap(parts[0]) + " " + parts.slice(1).map(p => cap(p).toUpperCase()).join(" ");
}
function code(r) { return "SV-" + String(r.id).padStart(3, "0"); }
function safeFileName(n) { return String(n).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(-80) || "fichier"; }
function horairesTexte(r) {
  if (!r.heureDepart) return "";
  return interne(r) ? "de " + r.heureDepart + (r.heureRetour ? " à " + r.heureRetour : "") : "départ " + r.heureDepart + (r.heureRetour ? ", retour " + r.heureRetour : "");
}
function horaires(r) { const h = horairesTexte(r); return h ? " (" + h + ")" : ""; }

/* ---------- État ---------- */
let db = null;
const state = {
  session: null, me: null, annuaire: [], requests: [], current: null,
  view: { name: "home" }, filter: "tous", flash: "", flashErr: false, loading: false, busy: false,
  login: { step: "password", email: "", error: "", info: "" },
  formFiles: [], formPieces: [], formRemoved: [],
  mustChange: false, authFlow: false, comptes: [], comptesRes: null
};
function me() { return state.me; }
/* Liste des élèves participants : une ligne par élève (copiée depuis École Directe). */
function lireEleves(texte) { return String(texte || "").split(/\r?\n/).map(l => l.replace(/\t+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean); }
function doublons(liste) { const vus = new Set(), d = new Set(); liste.forEach(l => { const k = l.toLowerCase(); if (vus.has(k)) d.add(l); vus.add(k); }); return [...d]; }
function voitListeEleves(r) { const m = me(); return !!m && (r.author && r.author.email === m.email || m.role === "chef" || m.role === "directeur" || ["compta", "viesco"].includes(m.service)); }

/* ---------- Correspondance base <-> écran ---------- */
function fromDb(x) {
  return {
    id: x.id, author: { email: x.auteur_email, name: x.auteur_nom || nameFromEmail(x.auteur_email) },
    status: x.statut, unite: x.unite || "", type: x.type, destination: x.destination, pays: x.pays || "",
    titre: x.titre || "", lieu: x.lieu || "", objectifs: x.objectifs || "", disciplines: x.disciplines || "",
    dateDebut: x.date_debut || "", dateFin: x.date_fin || "", heureDepart: x.heure_depart || "", heureRetour: x.heure_retour || "", rdv: x.rdv || "",
    classes: x.classes || "", classeEntiere: x.classe_entiere !== false, eleves: [], nbEleves: num(x.nb_eleves), nbDP: num(x.nb_dp), sansRepas: !!x.sans_repas, besoins: !!x.besoins,
    observations: x.observations || "", intervenant: x.intervenant || "", reglement: x.reglement || "", technique: x.technique || {},
    accompagnateurs: x.accompagnateurs || [], transports: x.transports || [], hebergement: x.hebergement || "",
    depenses: x.depenses || {}, coutAccomp: num(x.cout_accomp), participation: num(x.participation),
    pieces: x.pieces || [], financement: x.financement || null, taches: x.taches || null,
    checklist: x.etapes || {}, checkDir: x.etapes_direction || {},
    created: x.cree_le, updated: x.modifie_le, historique: [], liens: {}
  };
}
function toDb(x) {
  return {
    unite: x.unite || null, type: x.type, destination: x.destination, pays: x.pays,
    titre: x.titre, lieu: x.lieu, objectifs: x.objectifs, disciplines: x.disciplines,
    date_debut: x.dateDebut || null, date_fin: x.dateFin || null, heure_depart: x.heureDepart, heure_retour: x.heureRetour, rdv: x.rdv,
    classes: x.classes, classe_entiere: x.classeEntiere !== false, nb_eleves: Math.max(0, Math.round(num(x.nbEleves))), nb_dp: x.sansRepas ? 0 : Math.max(0, Math.round(num(x.nbDP))), sans_repas: !!x.sansRepas, besoins: x.besoins,
    accompagnateurs: x.accompagnateurs, transports: x.transports, hebergement: x.hebergement,
    depenses: x.depenses, cout_accomp: num(x.coutAccomp), participation: num(x.participation),
    observations: x.observations || "", intervenant: x.intervenant || "", reglement: x.reglement || "", technique: x.technique || {}
  };
}
function mk(o) {
  return Object.assign({
    id: null, author: null, status: "brouillon", unite: "", type: "sortie", destination: "france", pays: "",
    titre: "", lieu: "", objectifs: "", disciplines: "", dateDebut: "", dateFin: "", heureDepart: "", heureRetour: "", rdv: "",
    classes: "", classeEntiere: true, eleves: [], nbEleves: 0, nbDP: 0, sansRepas: false, besoins: false, observations: "", intervenant: "", reglement: "", technique: {}, accompagnateurs: [], transports: [], hebergement: "", depenses: {}, coutAccomp: 0, participation: 0,
    pieces: [], financement: null, taches: null, checklist: {}, checkDir: {}, historique: [], liens: {}
  }, o);
}

/* ---------- Annuaire ---------- */
function dirOf(r) { return state.annuaire.find(p => p.role === "directeur" && (p.unites || []).includes(r.unite)) || null; }
function dirName(unite) { const p = dirOf({ unite }); return p ? p.nom : "la direction de l’unité"; }
function chefName() { const p = state.annuaire.find(x => x.role === "chef"); return p ? p.nom : "le chef d’établissement"; }

/* ---------- Calculs et points de vigilance ---------- */
function totals(r) {
  const dep = r.depenses || {};
  const eleves = DEPENSES.reduce((s, [k]) => s + num(dep[k]), 0);
  const accomp = num(r.coutAccomp);
  const total = eleves + accomp;
  const n = num(r.nbEleves);
  return { eleves, accomp, total, parEleve: n > 0 ? total / n : 0, n };
}
function besoinsTexte(r) {
  const t = r.technique || {}, oui = BESOINS_TECH.filter(([k]) => t[k]).map(([, l]) => l.toLowerCase());
  return oui.length ? oui.join(", ") : "aucun matériel particulier";
}
function servicesNoms(r) {
  const n = ["la comptabilité", "la vie scolaire"].concat(interne(r) ? ["le service technique"] : ["le secrétariat"], repasAPrevoir(r) ? ["le chef de cuisine"] : []);
  return n.slice(0, -1).join(", ") + " et " + n[n.length - 1];
}
function repasAPrevoir(r) { return !r.sansRepas && num(r.nbDP) > 0; }
function staffAcc(r) { return (r.accompagnateurs || []).filter(a => ["enseignant", "personnel", "aesh"].includes(a.qualite)); }
function vigilance(r) {
  const out = [];
  const t = totals(r), part = num(r.participation), acc = r.accompagnateurs || [];
  if (part > 0 && t.n > 0 && part > t.parEleve + 0.005) out.push(["bad", "Bloquant", "La participation demandée aux familles (" + eur(part) + ") dépasse le coût par élève (" + eur(t.parEleve) + ")."]);
  if (t.total > 0 && !(r.pieces || []).length && !(r === state.formDraft && state.formFiles.length)) out.push(["warn", "À vérifier", "Le projet a un coût mais aucun devis n’est joint."]);
  if (r.status !== "validee" && repasAPrevoir(r) && daysUntil(r.dateDebut) < 21 && daysUntil(r.dateDebut) >= 0) out.push(["warn", "Délai", (interne(r) ? "Événement" : "Départ") + " dans moins de trois semaines : le chef de cuisine doit être prévenu sans attendre pour les " + num(r.nbDP) + " paniers repas."]);
  if (acc.some(a => a.qualite === "parent" || a.qualite === "autre")) out.push(["note", "Encadrement", "Les accompagnateurs extérieurs à l’établissement doivent être autorisés par écrit par le chef d’établissement." + (r.type === "voyage" ? " Pour un voyage, leur identité complète (nom de naissance, prénom, date et lieu de naissance) est demandée pour le contrôle d’honorabilité." : "")]);
  if ((r.transports || []).includes("Car")) out.push(["note", "Transport", "Car : entreprise inscrite au registre des transporteurs et conducteur professionnel ; ceinture obligatoire pour tous ; le conducteur ne compte pas dans l’encadrement."]);
  if (r.destination === "etranger") out.push(["note", "Étranger", "Autorisation de sortie de territoire pour chaque mineur, avec la copie de la pièce d’identité du signataire ; carte européenne d’assurance maladie recommandée en Europe ; déclaration Ariane par la direction."]);
  if (interne(r)) out.push(["note", "Dans l’établissement", "Les élèves restent sous la responsabilité de l’établissement pendant tout l’événement : prévoir l’encadrement par des personnels, la réservation et l’aménagement de la salle, et l’accueil de l’intervenant." + (r.intervenant ? "" : " Si un intervenant extérieur est prévu, indiquez son nom.")]);
  if (r.type === "voyage") out.push(["note", "Voyage", "Fiches sanitaires sous pli cacheté, trousse de secours et responsable santé (à demander à la vie scolaire)."]);
  if (r.besoins) out.push(["note", "Inclusion", "Élèves à besoins particuliers : anticiper les PAI, les aménagements et l’accompagnement AESH (accord écrit de son employeur pour un voyage). Les frais supplémentaires ne sont jamais facturés à la famille."]);
  return out;
}
function renderVig(list) {
  if (!list.length) return '<p class="hint">Aucun point particulier.</p>';
  return '<ul class="vig">' + list.map(([c, l, t]) => '<li class="' + c + '"><b>' + esc(l) + "</b><span>" + esc(t) + "</span></li>").join("") + "</ul>";
}

/* ---------- Checklists ---------- */
function checklistInterne(r) {
  const PART = num(r.participation) > 0, I = !!String(r.intervenant || "").trim();
  return [
    ["Préparation", [
      ["salle", "Réserver la salle et convenir de son aménagement (espace scénique, places assises, matériel)"],
      I && ["devis", "Faire signer le devis ou la convention de l’intervenant par la direction"],
      ["auto-technique", "Le service technique reçoit vos besoins (lieu, projection, sonorisation, aménagement) à la validation", true],
      ["auto-viesco", "Transmettre à la vie scolaire la date, les horaires, la salle et les classes concernées", true],
      repasAPrevoir(r) && ["auto-cuisine", "Le chef de cuisine est prévenu à la validation (" + plural(num(r.nbDP), "panier") + " repas)", true],
      repasAPrevoir(r) && ["paniers-remise", "Convenir avec le chef de cuisine de l’heure et du lieu de remise des paniers"],
      PART && ["echeancier", "Prendre rendez-vous avec Mme Berrami (comptabilité) pour la facturation aux familles"]
    ]],
    ["Familles", [
      PART ? ["circulaire", "Rédiger l’information aux familles (participation demandée) et la faire valider par la direction"]
        : ["info", "Informer les familles si nécessaire (École Directe)"]
    ]],
    ["Le jour J", [
      I && ["accueil", "Accueillir l’intervenant et le signaler à l’accueil"],
      ["presence", "Faire l’appel sur École Directe ou signaler les absents à la direction"],
      ["encadrement", "Assurer l’encadrement des élèves pendant tout l’événement"],
      ["reglement", "Rappeler que le règlement intérieur s’applique"]
    ]],
    ["Après", [
      I && ["facture", "Transmettre à la comptabilité la facture de l’intervenant" + (r.reglement ? ", selon les modalités de règlement prévues" : "")],
      ["bilan", "Faire un bilan avec les élèves" + (I ? " et l’intervenant" : "")]
    ]]
  ].map(([t, items]) => [t, items.filter(Boolean)]);
}
function checklistFor(r) {
  if (interne(r)) return checklistInterne(r);
  const V = r.type === "voyage", E = r.destination === "etranger", DP = repasAPrevoir(r);
  const P = [];
  P.push(["Réservations et budget", [
    ["transport", "Réserver le transport"], ["activites", "Réserver les activités et les visites"],
    V && ["hebergement", "Réserver l’hébergement"],
    num(r.participation) > 0 && ["echeancier", "Prendre rendez-vous avec Mme Berrami (comptabilité) pour fixer le prélèvement ou l’échéancier"],
    ["liste", "Éditer la liste nominative des élèves et la faire signer et tamponner par la direction (en prévoir plusieurs exemplaires : certains sites la conservent)"],
    ["auto-viesco", "Transmettre à la vie scolaire la date et les noms des adultes absents", true],
    DP && ["auto-cuisine", "Prévenir le chef de cuisine du nombre de paniers repas", true]
  ]]);
  P.push(["Familles", [
    ["circulaire", "Rédiger la circulaire d’information aux familles et la faire valider par la direction"],
    ["autorisations", "Envoyer les autorisations parentales et les récupérer signées"],
    ["documents", "Récupérer les documents nécessaires (autorisations, PAI…)"],
    V && ["reunion", "Organiser une réunion d’information pour les familles"]
  ]]);
  P.push(["Santé et sécurité", [
    ["arena", "Compléter les informations sur Arena une fois la sortie déclarée au rectorat par la direction"],
    E && ["ariane", "Demander à la direction la copie du courriel de déclaration Ariane"],
    V && ["trousse", "Prévoir une trousse de secours et un responsable santé (à demander à la vie scolaire)"],
    ["pai", "Vérifier les fiches médicales des élèves (PAI, allergies, traitements)"],
    V && ["fiches", "Faire remplir la fiche sanitaire par chaque famille, sous enveloppe fermée au nom de l’élève avec la mention « secret médical » (à rendre au retour)"],
    (V || E) && ["identite", "Demander aux élèves d’avoir une pièce d’identité"],
    E && ["ast", "Collecter les autorisations de sortie de territoire, avec la copie de la pièce d’identité du signataire"],
    ["mission", "Récupérer votre ordre de mission auprès de l’assistante de direction"]
  ]]);
  P.push(["Le jour J", [
    DP && ["paniers", "Récupérer les paniers repas à la cantine entre 7 h 30 et 10 h (prévoir un temps de distribution)"],
    ["presence", "Vérifier la présence de tous les élèves et des documents nécessaires" + (E ? " (pièce d’identité, autorisation de sortie de territoire)" : "")],
    ["materiel", "Vérifier le matériel : billets, trousse de secours, programme"],
    ["reglement", "Rappeler que le règlement intérieur s’applique pendant toute la sortie"],
    ["listes", "Donner à chaque accompagnateur la liste des élèves dont il a la charge"],
    ["appel", "Faire l’appel sur École Directe ou signaler les absents à la direction"]
  ]]);
  P.push(["Au retour", [
    ["recup", "Vérifier que tous les élèves sont récupérés par leur famille ou autorisés à rentrer seuls"],
    ["debrief", "Faire un débriefing avec les enseignants et les élèves"],
    ["bilan", "Rédiger un bilan pour améliorer les prochaines sorties"]
  ]]);
  return P.map(([t, items]) => [t, items.filter(Boolean)]);
}
function checklistDir(r) {
  if (interne(r)) return [
    String(r.intervenant || "").trim() && ["devis", "Signer le devis ou la convention de l’intervenant"],
    num(r.participation) > 0 && ["circulaire", "Valider l’information aux familles"],
    (r.accompagnateurs || []).some(a => a.qualite === "parent" || a.qualite === "autre") && ["benevoles", "Autoriser par écrit les intervenants bénévoles extérieurs à l’établissement"]
  ].filter(Boolean);
  return [
    ["rectorat", "Déclarer la sortie au rectorat"],
    r.destination === "etranger" && ["ariane", "Faire la déclaration Ariane et en transmettre la copie à l’organisateur"],
    ["circulaire", "Valider la circulaire d’information aux familles"],
    ["liste", "Signer et tamponner la liste nominative des élèves"],
    (r.accompagnateurs || []).some(a => a.qualite === "parent" || a.qualite === "autre") && ["benevoles", "Autoriser par écrit les accompagnateurs extérieurs à l’établissement"],
    (r.accompagnateurs || []).some(a => a.qualite === "aesh") && ["aesh", "Obtenir l’accord écrit de l’employeur de l’AESH"]
  ].filter(Boolean);
}

/* ---------- Accès aux données ---------- */
function errText(e) {
  const m = String((e && (e.message || e.error_description || e.msg)) || e || "");
  if (/rate limit|security purposes|after \d+ seconds/i.test(m)) return "Trop de demandes en peu de temps : patientez une minute avant de réessayer.";
  if (/invalid login credentials/i.test(m)) return "Adresse ou mot de passe incorrect. Saisissez exactement l’identifiant indiqué dans le courriel, et le mot de passe du courriel le plus récent : chaque nouveau mot de passe provisoire annule le précédent.";
  if (/banned/i.test(m)) return "Ce compte est désactivé. Adressez-vous à l’administrateur de l’outil.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Connexion au serveur impossible. Vérifiez votre accès à internet et réessayez.";
  if (/JWT|expired|invalid claim|session/i.test(m)) return "Votre session a expiré : reconnectez-vous.";
  if (/row-level security/i.test(m)) return "Action non autorisée pour votre profil.";
  return m || "Une erreur inattendue est survenue.";
}
function pwdErr(e) {
  const m = String((e && e.message) || "");
  if (/different from the old/i.test(m)) return "Choisissez un mot de passe différent de l’actuel (ou du mot de passe provisoire).";
  if (/at least|characters|weak|should contain|pwned|leaked/i.test(m)) return "Ce mot de passe est trop faible : 8 caractères au moins, avec des lettres et des chiffres.";
  if (/reauthenticat|recent/i.test(m)) return "Par sécurité, déconnectez-vous puis reconnectez-vous avant de changer de mot de passe.";
  return errText(e);
}
// Retire les espaces et caractères invisibles ajoutés par un copier-coller depuis un courriel.
function nettoyerMdp(p) { return String(p || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, ""); }
function pwdProbleme(p1, p2) {
  if (p1 !== nettoyerMdp(p1)) return "Le mot de passe ne doit commencer ni finir par une espace.";
  if (p1.length < 8) return "Le mot de passe doit compter au moins 8 caractères.";
  if (!/[A-Za-zÀ-ÿ]/.test(p1) || !/\d/.test(p1)) return "Le mot de passe doit contenir des lettres et des chiffres.";
  if (p1 !== p2) return "Les deux mots de passe ne sont pas identiques.";
  return "";
}
async function loadAnnuaire() {
  const { data, error } = await db.from("personnes").select("*").eq("actif", true);
  if (error) throw error;
  state.annuaire = data || [];
}
async function loadList() {
  const { data, error } = await db.from("demandes").select("*").order("date_debut", { ascending: true, nullsFirst: false });
  if (error) throw error;
  state.requests = (data || []).map(fromDb);
}
async function loadDetail(id) {
  const [a, b] = await Promise.all([
    db.from("demandes").select("*").eq("id", id).maybeSingle(),
    db.from("historique").select("*").eq("demande_id", id).order("cree_le", { ascending: true })
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  if (!a.data) { state.current = null; return; }
  const r = fromDb(a.data);
  r.historique = (b.data || []).map(h => ({ who: h.auteur, action: h.action, date: h.cree_le, comment: h.commentaire }));
  if (!r.classeEntiere && voitListeEleves(r)) {
    const p = await db.from("participants").select("eleves").eq("demande_id", id).maybeSingle();
    if (!p.error && p.data) r.eleves = p.data.eleves || [];
  }
  if (r.pieces.length) {
    const { data } = await db.storage.from(BUCKET).createSignedUrls(r.pieces.map(p => p.chemin), 3600);
    (data || []).forEach(x => { if (x && x.signedUrl) r.liens[x.path] = x.signedUrl; });
  }
  state.current = r;
}
async function callWorkflow(body) {
  const { data, error } = await db.functions.invoke("workflow", { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (_) { /* réponse non JSON */ }
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data || {};
}
function bilanCourriels(res) {
  const n = res.envoyes || 0, ko = (res.echecs || []).length;
  let t = n ? " " + plural(n, "courriel envoyé", "courriels envoyés") + "." : "";
  if (ko) { t += " Attention : " + plural(ko, "courriel n’a", "courriels n’ont") + " pas pu partir (voir la table « courriels » dans Supabase)."; state.flashErr = true; }
  return t;
}

/* ---------- Navigation ---------- */
function homeOf(role) { return { prof: "mine", directeur: "todo", chef: "all", service: "svc" }[role] || "mine"; }
function setHash(view) {
  try {
    if (view.name === "detail" && view.id) history.replaceState(null, "", "#demande-" + view.id);
    else if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  } catch (_) { /* navigateur sans history */ }
}
async function go(name, id, opts) {
  opts = opts || {};
  state.view = { name, id: id || null };
  if (!opts.keepFlash) { state.flash = ""; state.flashErr = false; }
  state.loading = true; render();
  try {
    if (name === "detail" || name === "edit") await loadDetail(id);
    else if (name === "comptes") await loadComptes();
    else if (!["new", "outils", "mdp"].includes(name)) await loadList();
    if (name === "new" || name === "edit") { state.formFiles = []; state.formRemoved = []; }
  } catch (e) { state.flash = errText(e); state.flashErr = true; }
  state.loading = false;
  setHash(state.view);
  render();
  if (!opts.keepScroll) window.scrollTo(0, 0);
}

/* ---------- Connexion ---------- */
async function onSession(session, opts) {
  opts = opts || {};
  const email = String((session && session.user && session.user.email) || "").toLowerCase();
  if (!email.endsWith("@" + DOMAIN)) {
    await db.auth.signOut();
    state.session = null; state.me = null;
    state.login = { step: "password", email: "", error: "Seules les adresses de l’établissement (prenom.nom@" + DOMAIN + ") donnent accès à l’outil.", info: "" };
    render(); return;
  }
  state.session = session;
  try { await loadAnnuaire(); } catch (e) { state.annuaire = []; state.flash = errText(e); state.flashErr = true; }
  const p = state.annuaire.find(x => x.email === email);
  state.me = p ? { email, name: p.nom, title: p.titre, role: p.role, unites: p.unites || [], service: p.service || null, admin: !!p.admin }
               : { email, name: nameFromEmail(email), title: "Personnel de l’établissement", role: "prof", unites: [], service: null, admin: false };
  const meta = (session.user && session.user.user_metadata) || {};
  state.mustChange = !!opts.forcer || !!meta.doit_changer_mdp;
  if (opts.erreur) { state.flash = opts.erreur; state.flashErr = true; }
  if (state.mustChange) { state.view = { name: "mdp" }; render(); window.scrollTo(0, 0); return; }
  let cible = null;
  try { cible = localStorage.getItem("sv-cible"); localStorage.removeItem("sv-cible"); } catch (_) { }
  const m = /^#demande-(\d+)$/.exec(location.hash);
  if (m) cible = m[1];
  if (cible) go("detail", Number(cible), { keepFlash: true }); else go(homeOf(state.me.role), null, { keepFlash: true });
}
async function signIn(email, password) {
  state.busy = true; state.authFlow = true; render();
  let { data, error } = await db.auth.signInWithPassword({ email, password });
  const propre = nettoyerMdp(password);
  if (error && /invalid login credentials/i.test(error.message || "") && propre && propre !== password) {
    ({ data, error } = await db.auth.signInWithPassword({ email, password: propre }));
  }
  state.busy = false;
  if (error || !data || !data.session) {
    state.authFlow = false;
    state.login = { step: "password", email, error: errText(error || { message: "Invalid login credentials" }), info: "" };
    render(); const f = $("#login-password"); if (f) f.focus(); return;
  }
  await onSession(data.session);
  state.authFlow = false;
}
async function sendResetCode(email) {
  state.busy = true; render();
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  state.busy = false;
  if (error) { state.login = { step: "reset", email, error: errText(error), info: "" }; render(); return; }
  state.login = { step: "reset-code", email, error: "", info: "Si un compte existe pour " + email + ", un code vient de lui être envoyé." };
  render();
  const c = $("#reset-code"); if (c) c.focus();
}
async function resetWithCode(token, pwd) {
  const email = state.login.email;
  state.busy = true; state.authFlow = true; render();
  const v = await db.auth.verifyOtp({ email, token, type: "recovery" });
  if (v.error || !v.data || !v.data.session) {
    state.busy = false; state.authFlow = false;
    state.login = Object.assign({}, state.login, { error: /rate limit|security purposes/i.test((v.error && v.error.message) || "") ? errText(v.error) : "Code incorrect ou expiré. Demandez un nouveau code.", info: "" });
    render(); return;
  }
  const u = await db.auth.updateUser({ password: pwd, data: { doit_changer_mdp: false } });
  state.busy = false;
  const s2 = (await db.auth.getSession()).data.session || v.data.session;
  if (u.error) await onSession(s2, { forcer: true, erreur: pwdErr(u.error) });
  else { state.flash = "Votre nouveau mot de passe est enregistré."; state.flashErr = false; await onSession(s2); }
  state.authFlow = false;
}
async function changePassword(p1, p2) {
  const err = $("#mdp-err"), pb = pwdProbleme(p1, p2);
  if (pb) { err.textContent = pb; return; }
  const btn = $("#mdp-form button[type=submit]"); if (btn) { btn.disabled = true; btn.textContent = "Enregistrement…"; }
  const { error } = await db.auth.updateUser({ password: p1, data: { doit_changer_mdp: false } });
  if (error) { err.textContent = pwdErr(error); if (btn) { btn.disabled = false; btn.textContent = "Enregistrer mon mot de passe"; } return; }
  const premiere = state.mustChange;
  state.mustChange = false; state.flashErr = false;
  state.flash = premiere ? "Votre mot de passe est enregistré. Bienvenue dans Cap Projets." : "Votre mot de passe a été modifié.";
  go(homeOf(me().role), null, { keepFlash: true });
}

/* ---------- Comptes du personnel (administrateur) ---------- */
async function loadComptes() {
  const res = await callWorkflow({ action: "lister_comptes" });
  state.comptes = res.comptes || [];
}
const STATUT_COMPTE = { cree: ["Compte créé", "ok-c"], existe: ["Déjà existant", "draft-c"], refusee: ["Adresse refusée", "bad-c"], erreur: ["Erreur", "bad-c"], reinitialise: ["Nouveau mot de passe provisoire", "ok-c"], desactive: ["Désactivé", "bad-c"], reactive: ["Réactivé", "ok-c"] };
function renderComptes() {
  const list = state.comptes;
  const nbProv = list.filter(c => c.provisoire && !c.desactive).length, nbAct = list.filter(c => !c.provisoire && !c.desactive).length, nbDes = list.filter(c => c.desactive).length;
  const dis = state.busy ? " disabled" : "";
  let h = '<div class="page-head"><div><h1>Comptes du personnel</h1><p>Chaque personne se connecte avec son adresse @' + esc(DOMAIN) + '. Elle reçoit par courriel un mot de passe provisoire, personnel, qu’elle remplace à sa première connexion.</p></div></div>';
  h += '<div class="tiles">' + tile(nbAct, "comptes actifs", "ok") + tile(nbProv, "en attente de première connexion", "warn") + tile(nbDes, "désactivés", "bad") + "</div>";
  h += '<section class="card stack"><div><h2>Créer des comptes</h2><p class="hint">Collez les adresses du personnel, une par ligne ou séparées par des virgules. Les comptes existants sont ignorés. Brevo envoie au plus 300 courriels par jour : au-delà de 250 adresses, faites plusieurs envois.</p></div>' +
    '<div class="field"><label for="comptes-emails">Adresses</label><textarea id="comptes-emails" rows="6" placeholder="prenom.nom@' + esc(DOMAIN) + '"></textarea><span class="err" id="comptes-err"></span></div>' +
    '<div class="actions"><button class="btn primary" data-action="creer-comptes"' + dis + ">" + (state.busy ? "Création en cours…" : "Créer les comptes et envoyer les mots de passe") + "</button></div></section>";
  if (state.comptesRes && state.comptesRes.length) {
    const avecMdp = state.comptesRes.some(r => r.mdp);
    h += '<section class="card" id="comptes-res"><h2>Résultat</h2>' +
      (avecMdp ? '<p class="hint" style="margin:4px 0 12px">Le mot de passe provisoire n’est enregistré nulle part : copiez-le ou envoyez-le avant de quitter l’outil. Sinon, « Nouveau mot de passe » en crée un autre (le précédent ne fonctionne alors plus).</p>' : "") +
      '<div class="stack res-list">' +
      state.comptesRes.map((r, i) => {
        const st = STATUT_COMPTE[r.statut] || [r.statut, "draft-c"];
        return '<div class="res-item"><div class="row between" style="gap:8px;flex-wrap:wrap"><strong style="word-break:break-all">' + esc(r.email) + '</strong><span class="pill ' + st[1] + '">' + esc(st[0]) + "</span></div>" +
          (r.mdp ? '<div class="mdp-cell"><span class="hint">Mot de passe provisoire</span><code class="mdp">' + esc(r.mdp) + '</code><button class="btn small" data-action="copier-mdp" data-i="' + i + '">Copier</button><button class="btn small ghost" data-action="copier-message" data-i="' + i + '">Copier le message</button></div>' : "") +
          (r.detail ? '<div class="hint"' + (r.envoye === false ? ' style="color:var(--bad)"' : "") + ">" + esc(r.detail) + "</div>" : "") + "</div>";
      }).join("") + "</div></section>";
  }
  h += '<section class="card stack"><div class="row between"><h2>Comptes existants (' + list.length + ')</h2><input id="comptes-filtre" type="text" placeholder="Rechercher une adresse" aria-label="Rechercher une adresse" style="max-width:280px"></div>' +
    (list.length ? '<div class="tbl-wrap"><table class="t"><thead><tr><th>Adresse</th><th>État</th><th>Dernière connexion</th><th class="r">Actions</th></tr></thead><tbody>' +
      list.map(c => {
        const etat = c.desactive ? ["Désactivé", "bad-c"] : c.provisoire ? ["Mot de passe provisoire", "warn-c"] : ["Actif", "ok-c"];
        const soi = c.email === me().email;
        return '<tr data-email="' + esc(c.email) + '"><td>' + esc(c.email) + '</td><td><span class="pill ' + etat[1] + '">' + etat[0] + "</span></td><td>" + (c.derniere_connexion ? esc(stamp(c.derniere_connexion)) : '<span class="hint">jamais</span>') + '</td><td class="r"><div class="row" style="justify-content:flex-end;gap:6px">' +
          (c.desactive ? "" : '<button class="btn small" data-action="compte-reinit" data-email="' + esc(c.email) + '"' + dis + ">Nouveau mot de passe</button>") +
          (soi ? "" : c.desactive ? '<button class="btn small" data-action="compte-reactiver" data-email="' + esc(c.email) + '"' + dis + ">Réactiver</button>" : '<button class="btn small danger" data-action="compte-desactiver" data-email="' + esc(c.email) + '"' + dis + ">Désactiver</button>") +
          "</div></td></tr>";
      }).join("") + "</tbody></table></div>" : '<p class="hint">Aucun compte pour le moment.</p>') +
    '<p class="hint">« Désactiver » bloque l’accès d’une personne qui quitte l’établissement, sans effacer ses demandes.</p></section>';
  return h;
}
async function actionComptes(body, okMsg) {
  if (state.busy) return;
  state.busy = true; $$("#app .btn").forEach(b => { b.disabled = true; });
  try {
    const res = await callWorkflow(body);
    state.comptesRes = res.resultats || [];
    state.busy = false; state.flashErr = false; state.flash = okMsg(res);
    await go("comptes", null, { keepFlash: true, keepScroll: true });
    const rc = $("#comptes-res"); if (rc && state.comptesRes.some(r => r.mdp)) rc.scrollIntoView({ block: "start", behavior: "smooth" });
  } catch (e) {
    state.busy = false; state.flash = errText(e); state.flashErr = true; render();
  }
}

/* ---------- Rendu ---------- */
function footer() {
  return '<footer class="foot"><span>' + esc(ETAB.nom) + " · " + esc(ETAB.adresse) + "</span><span>" + esc(ETAB.tel) + " · " + esc(ETAB.mail) + '</span><a href="' + ETAB.site + '" target="_blank" rel="noopener">protectorat.net</a></footer>';
}
function render() {
  renderTop();
  const app = $("#app");
  if (!db) return;
  if (!me()) { app.innerHTML = renderLogin() + footer(); return; }
  if (state.mustChange) {
    app.innerHTML = (state.flash ? '<div class="flash' + (state.flashErr ? " err-flash" : "") + '" role="status">' + esc(state.flash) + "</div>" : "") + renderMdp() + footer();
    return;
  }
  const v = state.view;
  let html = renderTabs();
  if (state.flash) html += '<div class="flash' + (state.flashErr ? " err-flash" : "") + '" role="status">' + esc(state.flash) + "</div>";
  if (state.loading) { app.innerHTML = html + '<div class="card loading">Chargement…</div>'; return; }
  if (v.name === "detail") html += state.current ? renderDetail(state.current) : '<div class="card empty">Cette demande n’existe pas ou n’est pas accessible avec votre profil.</div>';
  else if (v.name === "new") html += renderForm(null);
  else if (v.name === "edit") { const r = state.current; html += r && r.author.email === me().email && ["brouillon", "complements"].includes(r.status) ? renderForm(r) : '<div class="card empty">Cette demande ne peut plus être modifiée.</div>'; }
  else if (v.name === "mine") html += renderMine();
  else if (v.name === "todo") html += renderTodo();
  else if (v.name === "all") html += renderAll();
  else if (v.name === "svc") html += renderSvc();
  else if (v.name === "valid" && me().role === "service") html += renderValid();
  else if (v.name === "cal") html += renderCal();
  else if (v.name === "outils") html += renderOutils();
  else if (v.name === "mdp") html += renderMdp();
  else if (v.name === "comptes" && me().admin) html += renderComptes();
  else { go(homeOf(me().role)); return; }
  app.innerHTML = html + footer();
  if (v.name === "new" || v.name === "edit") syncForm();
  if (v.name === "detail") updateFinSum();
}
function renderTop() {
  const el = $("#who"), m = me();
  if (!m) { el.innerHTML = ""; return; }
  el.innerHTML = '<details class="menu" id="menu"><summary aria-label="Profil et déconnexion"><span class="avatar" aria-hidden="true">' + esc(initials(m.name)) + '</span><span class="who-name"><strong>' + esc(m.name) + "</strong><span>" + esc(m.title) + '</span></span><span class="caret" aria-hidden="true"></span></summary>' +
    '<div class="menu-panel"><div><strong>' + esc(m.name) + '</strong><div class="hint">' + esc(m.title) + '</div><div class="hint">' + esc(m.email) + "</div></div>" +
    '<button class="btn" data-action="tab" data-view="mdp">Changer mon mot de passe</button>' +
    '<button class="btn" data-action="logout">Se déconnecter</button></div></details>';
}
const voirMdp = ids => '<label class="inline show-pwd"><input type="checkbox" data-voir-mdp="' + ids + '"> <span>Afficher le mot de passe</span></label>';
function renderLogin() {
  const L = state.login, dis = state.busy ? " disabled" : "";
  const err = '<span class="err" id="login-err">' + esc(L.error) + "</span>";
  const emailField = (id, ac) => '<div class="field"><label for="' + id + '">Identifiant : votre adresse de l’établissement</label><input id="' + id + '" type="email" inputmode="email" autocomplete="' + ac + '" autocapitalize="off" placeholder="prenom.nom@' + DOMAIN + '" value="' + esc(L.email) + '"></div>';
  let form;
  if (L.step === "reset") {
    form = '<form id="reset-form" class="stack" novalidate><p>Indiquez votre adresse : vous recevrez un code pour choisir un nouveau mot de passe.</p>' + emailField("reset-email", "email") + err +
      '<button class="btn primary" type="submit"' + dis + ">" + (state.busy ? "Envoi en cours…" : "Recevoir un code") + '</button><button class="link" type="button" data-action="login-back">Retour à la connexion</button></form>';
  } else if (L.step === "reset-code") {
    form = '<form id="reset-code-form" class="stack" novalidate>' + (L.info ? '<div class="callout">' + esc(L.info) + " Il peut mettre une minute à arriver ; pensez à regarder dans les courriels indésirables.</div>" : "") +
      '<div class="field"><label for="reset-code">Code reçu par courriel</label><input id="reset-code" class="code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••"></div>' +
      '<div class="field"><label for="reset-mdp1">Nouveau mot de passe</label><input id="reset-mdp1" type="password" autocomplete="new-password"><span class="hint">8 caractères au moins, avec des lettres et des chiffres.</span></div>' +
      '<div class="field"><label for="reset-mdp2">Confirmez le mot de passe</label><input id="reset-mdp2" type="password" autocomplete="new-password"></div>' + voirMdp("reset-mdp1,reset-mdp2") + err +
      '<button class="btn primary" type="submit"' + dis + ">" + (state.busy ? "Enregistrement…" : "Enregistrer et me connecter") + "</button>" +
      '<div class="row"><button class="link" type="button" data-action="resend">Recevoir un nouveau code</button><button class="link" type="button" data-action="login-back">Retour à la connexion</button></div></form>';
  } else {
    form = '<form id="login-form" class="stack" novalidate>' + emailField("login-email", "username") +
      '<div class="field"><label for="login-password">Mot de passe</label><input id="login-password" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false"' + (L.error ? ' class="invalid" aria-describedby="login-err"' : "") + ">" + err + voirMdp("login-password") + "</div>" +
      '<button class="btn primary" type="submit"' + dis + ">" + (state.busy ? "Connexion…" : "Se connecter") + '</button><button class="link" type="button" data-action="forgot">Mot de passe oublié ?</button></form>';
  }
  return '<div class="login"><div class="card login-card"><div class="login-logo"><img src="img/logo.png" alt="Protectorat Saint-Joseph"></div><h1>Cap Projets</h1><p>Sorties, voyages et événements : préparez, déposez et suivez vos demandes.</p>' + form + "</div>" +
    '<div class="card"><h2>Comment se connecter</h2><ol class="ref-list"><li>Votre identifiant est votre adresse de l’établissement, sous la forme prenom.nom@' + esc(DOMAIN) + ".</li><li>La première fois, utilisez le mot de passe provisoire reçu par courriel : l’outil vous demande ensuite de choisir le vôtre.</li><li>Vous restez connecté sur cet appareil tant que vous ne vous déconnectez pas.</li><li>Mot de passe oublié : un code vous est envoyé par courriel pour en choisir un nouveau.</li></ol>" +
    '<p class="hint" style="margin-top:12px">Pas encore de compte ? Adressez-vous à l’administrateur de l’outil, M. Sivasuthasarma.</p></div></div>';
}
function renderMdp() {
  const forced = state.mustChange;
  return '<div class="page-head"><div><h1>' + (forced ? "Choisissez votre mot de passe" : "Changer mon mot de passe") + "</h1><p>" +
    (forced ? "Vous vous êtes connecté avec un mot de passe provisoire. Choisissez le vôtre pour continuer : il remplacera celui reçu par courriel." : "Le nouveau mot de passe remplacera l’actuel sur tous vos appareils.") + "</p></div></div>" +
    '<form id="mdp-form" class="card stack" novalidate style="max-width:520px">' +
    '<div class="field"><label for="mdp-1">Nouveau mot de passe</label><input id="mdp-1" type="password" autocomplete="new-password"><span class="hint">8 caractères au moins, avec des lettres et des chiffres.</span></div>' +
    '<div class="field"><label for="mdp-2">Confirmez le mot de passe</label><input id="mdp-2" type="password" autocomplete="new-password"><span class="err" id="mdp-err"></span></div>' + voirMdp("mdp-1,mdp-2") +
    '<button class="btn primary" type="submit">Enregistrer mon mot de passe</button>' + (forced ? '<button class="link" type="button" data-action="logout">Se déconnecter</button>' : "") + "</form>";
}
function renderTabs() {
  const m = me(), list = state.requests;
  const todo = m.role === "directeur" ? list.filter(r => r.status === "soumise" && m.unites.includes(r.unite)).length : 0;
  const svcTodo = m.role === "service" ? list.filter(r => r.taches && r.taches[m.service] === false).length : 0;
  const mineComp = list.filter(r => r.author.email === m.email && r.status === "complements").length;
  const tabs = {
    prof: [["mine", "Mes demandes", mineComp], ["new", "Nouvelle demande"], ["outils", "Boîte à outils"]],
    directeur: [["todo", "À traiter", todo], ["all", "Toutes les demandes"], ["cal", "Calendrier"], ["mine", "Mes demandes", mineComp], ["outils", "Boîte à outils"]],
    chef: [["all", "Toutes les demandes"], ["cal", "Calendrier"], ["mine", "Mes demandes", mineComp], ["outils", "Boîte à outils"]],
    service: [["svc", "À traiter", svcTodo], ["valid", "Demandes validées"], ["cal", "Calendrier"]]
  }[m.role] || [["mine", "Mes demandes"]];
  if (m.admin) tabs.push(["comptes", "Comptes"]);
  const cur = state.view.name;
  return '<nav class="tabs" aria-label="Sections">' + tabs.map(([k, l, c]) => '<button class="tab" data-action="tab" data-view="' + k + '"' + (cur === k ? ' aria-current="page"' : "") + ">" + esc(l) + (c ? '<span class="count">' + c + "</span>" : "") + "</button>").join("") + "</nav>";
}
function unitLabel(r) { return UNITES[r.unite] ? UNITES[r.unite].label : "Unité à préciser"; }
function reqRow(r, extra) {
  const s = STATUS[r.status] || STATUS.brouillon;
  const day = r.dateDebut ? d(r.dateDebut).getDate() : "–";
  const mon = r.dateDebut ? d(r.dateDebut).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "") : "";
  const meta = [code(r), unitLabel(r), r.classes || "classes à préciser", (TYPES[r.type] || TYPES.sortie).court, extra || r.author.name].filter(Boolean).join(" · ");
  return '<button class="req-row" data-action="open" data-id="' + r.id + '"><span class="rr-date"><span class="rr-day">' + day + '</span><span class="rr-mon">' + esc(mon) + "</span></span>" +
    '<span class="rr-main"><span class="rr-title">' + esc(r.titre || "Sans titre") + '</span><span class="rr-meta">' + esc(meta) + "</span></span>" +
    '<span class="pill ' + s.cls + '">' + s.label + "</span></button>";
}
function listOf(rows, emptyText) { return rows.length ? '<div class="list">' + rows.join("") + "</div>" : '<div class="list"><div class="empty">' + esc(emptyText) + "</div></div>"; }
function byDate(a, b) { return (a.dateDebut || "9999").localeCompare(b.dateDebut || "9999"); }
function tile(n, l, c) { return '<div class="tile ' + (c || "") + '"><div class="n">' + n + '</div><div class="l">' + esc(l) + "</div></div>"; }
function kv(pairs) { return '<dl class="kv">' + pairs.map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + esc(v == null || v === "" ? "non renseigné" : v) + "</dd>").join("") + "</dl>"; }

function renderMine() {
  const rs = state.requests.filter(r => r.author.email === me().email).sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  const comp = rs.filter(r => r.status === "complements").length;
  return '<div class="page-head"><div><h1>Mes demandes</h1><p>Retrouvez vos demandes, leur état et les retours de la direction.</p></div><button class="btn primary" data-action="tab" data-view="new">Nouvelle demande</button></div>' +
    (comp ? '<div class="callout" style="margin-bottom:14px"><strong>' + plural(comp, "demande attend", "demandes attendent") + " vos compléments.</strong> Ouvrez-la pour lire le commentaire de la direction.</div>" : "") +
    listOf(rs.map(r => reqRow(r, "modifiée le " + stamp(r.updated))), "Vous n’avez encore déposé aucune demande.");
}
function renderTodo() {
  const m = me(), vis = state.requests.filter(r => m.unites.includes(r.unite) && r.status !== "brouillon");
  const todo = vis.filter(r => r.status === "soumise").sort(byDate);
  const units = m.unites.map(u => ({ college: "du collège", lycee: "du lycée", sup: "du pôle supérieur" }[u])).filter(Boolean).join(" et ");
  return '<div class="page-head"><div><h1>À traiter</h1><p>Demandes ' + esc(units) + " en attente de votre décision. " + esc(chefName()) + " est informé de chacune.</p></div></div>" +
    '<div class="tiles">' + tile(todo.length, "en attente de décision", "warn") + tile(vis.filter(r => r.status === "complements").length, "compléments demandés", "info") + tile(vis.filter(r => r.status === "validee" && daysUntil(r.dateDebut) >= 0).length, "validées à venir", "ok") + "</div>" +
    listOf(todo.map(r => reqRow(r)), "Aucune demande en attente. Tout est à jour.");
}
function renderAll() {
  const m = me();
  const vis = state.requests.filter(r => r.status !== "brouillon" && (m.role === "chef" || m.unites.includes(r.unite)));
  const f = state.filter;
  const rows = vis.filter(r => f === "tous" || r.status === f).sort(byDate);
  const filt = [["tous", "Toutes"], ["soumise", "En attente"], ["complements", "Compléments"], ["validee", "Validées"], ["refusee", "Refusées"]];
  const intro = m.role === "chef" ? "Toutes les demandes de l’établissement. Vous pouvez donner un avis ou arbitrer depuis chaque demande." : "Toutes les demandes de votre unité.";
  return '<div class="page-head"><div><h1>Toutes les demandes</h1><p>' + esc(intro) + "</p></div></div>" +
    '<div class="tiles">' + tile(vis.filter(r => r.status === "soumise").length, "en attente", "warn") + tile(vis.filter(r => r.status === "complements").length, "compléments demandés", "info") + tile(vis.filter(r => r.status === "validee").length, "validées", "ok") + tile(vis.filter(r => r.status === "refusee").length, "refusées", "bad") + "</div>" +
    '<div class="filters" role="group" aria-label="Filtrer par état">' + filt.map(([k, l]) => '<button class="tab" data-action="filter" data-f="' + k + '"' + (f === k ? ' aria-current="page"' : "") + ">" + l + "</button>").join("") + "</div>" +
    listOf(rows.map(r => reqRow(r)), "Aucune demande dans cette catégorie.");
}
function svcDetails(r, svc) {
  const t = totals(r), part = num(r.participation), staff = staffAcc(r);
  if (svc === "compta") {
    const fin = r.financement ? FIN.filter(([k]) => num(r.financement[k]) > 0).map(([k, l]) => l + " : " + eur(num(r.financement[k]))).join(" · ") : "non renseigné";
    return kv([["Élèves", plural(num(r.nbEleves), "élève")], ["Coût par élève", eur(t.parEleve) + (interne(r) ? "" : " (accompagnateurs compris)")], ["Part des familles", part > 0 ? eur(part) + " × " + num(r.nbEleves) + " = " + eur(part * num(r.nbEleves)) : "aucune"], ["Financement par élève", fin]].concat(r.intervenant ? [["Intervenant", r.intervenant]] : [], r.reglement ? [["Règlement du prestataire", r.reglement]] : [], [["Pièces jointes", (r.pieces || []).map(p => p.nom).join(", ") || "aucune"]]));
  }
  if (svc === "technique") return kv([["Date", dateRange(r) + horaires(r)], ["Lieu", r.lieu], ["Public", (r.classes || "") + " – " + plural(num(r.nbEleves), "élève") + ", " + plural((r.accompagnateurs || []).length, "adulte")], ["Organisateur", r.author.name + " (" + r.author.email + ")"]].concat(r.intervenant ? [["Intervenant", r.intervenant]] : [], [["Besoins", besoinsTexte(r)], ["Précisions", (r.technique || {}).precisions || "aucune"]]));
  if (svc === "viesco" && interne(r)) return kv([["Date", dateRange(r) + horaires(r)], ["Classes", r.classes], ["Lieu", r.lieu], ["Encadrement", staff.map(a => a.nom).join(", ") || "à préciser"]]);
  if (svc === "viesco") return kv([["Date(s)", dateRange(r) + horaires(r)], ["Classes", r.classes], ["Adultes absents", staff.map(a => a.nom).join(", ") || "aucun"], ["Rendez-vous", r.rdv || "non précisé"]].concat(r.type === "voyage" ? [["Voyage", "responsable santé à désigner"]] : []));
  if (svc === "secretariat") return kv([["Date(s)", dateRange(r) + horaires(r)], ["Ordres de mission", staff.map(a => a.nom + " (" + QUALITES[a.qualite].toLowerCase() + ")").join(", ") || "aucun"], ["Destination", r.lieu + (r.pays ? " (" + r.pays + ")" : "")]]);
  if (svc === "cuisine" && interne(r)) return kv([["Paniers repas", plural(num(r.nbDP), "panier") + " pour le " + dLong(r.dateDebut)], ["Événement", r.titre + " – " + r.lieu + (r.heureDepart ? ", " + horairesTexte(r) : "")], ["Classes", r.classes], ["Cantine", "ces demi-pensionnaires ne déjeuneront pas à la cantine ce jour-là"], ["Remise des paniers", "heure et lieu à convenir avec " + r.author.name + " (" + r.author.email + ")"]]);
  if (svc === "cuisine") return kv([["Paniers repas", plural(num(r.nbDP), "panier") + " pour le " + dLong(r.dateDebut)], ["Absents de la cantine", dateRange(r)], ["Départ", r.heureDepart || "heure non précisée"], ["Classes", r.classes], ["Retrait", "à la cantine entre 7 h 30 et 10 h, sauf autre arrangement avec l’organisateur"]]);
  return "";
}
function renderSvc() {
  const svc = me().service;
  if (!svc || !SERVICES[svc]) return '<div class="card empty">Votre profil n’est rattaché à aucun service. Demandez à l’administrateur de l’outil de compléter la table « personnes ».</div>';
  const rs = state.requests.filter(r => r.status === "validee" && r.taches && svc in r.taches).sort(byDate);
  const todo = rs.filter(r => r.taches[svc] === false), done = rs.filter(r => r.taches[svc] === true);
  const card = r => '<div class="card svc-card"><div class="row between"><div><h2>' + esc(r.titre) + '</h2><p class="hint">' + esc(code(r) + " · " + unitLabel(r) + " · " + dateRange(r) + " · organisateur : " + r.author.name) + "</p></div>" +
    (r.taches[svc] ? '<span class="pill ok-c">Fait</span>' : '<span class="pill warn-c">À faire</span>') + "</div>" + svcDetails(r, svc) +
    '<div class="actions"><button class="btn ' + (r.taches[svc] ? "" : "ok") + '" data-action="task" data-id="' + r.id + '" data-fait="' + (r.taches[svc] ? "0" : "1") + '"' + (state.busy ? " disabled" : "") + ">" + (r.taches[svc] ? "Marquer comme non fait" : "Marquer comme fait") + '</button><button class="btn ghost" data-action="open" data-id="' + r.id + '">Voir la demande complète</button></div></div>';
  return '<div class="page-head"><div><h1>' + esc(SERVICES[svc].label) + "</h1><p>Projets validés par la direction qui demandent une action de votre part : " + esc(SERVICES[svc].task.toLowerCase()) + ".</p></div></div>" +
    '<div class="tiles">' + tile(todo.length, "à faire", "warn") + tile(done.length, "faites", "ok") + "</div>" +
    '<div class="stack">' + (todo.length ? todo.map(card).join("") : '<div class="card empty">Rien à faire pour le moment.</div>') +
    (done.length ? '<h2 style="margin-top:8px">Déjà faites</h2>' + done.map(card).join("") : "") + "</div>";
}
function blocEleves(r) {
  if (r.classeEntiere) return "";
  if (!voitListeEleves(r)) return '<p class="hint" style="margin-top:12px">Liste nominative réservée à la direction, à la vie scolaire et à la comptabilité.</p>';
  const l = r.eleves || [];
  if (!l.length) return '<p class="hint" style="margin-top:12px">Aucune liste d’élèves enregistrée.</p>';
  return '<div class="eleves-bloc"><div class="eleves-tete"><strong>Élèves participants (' + l.length + ")</strong>" +
    '<button type="button" class="btn small" data-action="copier-eleves">Copier la liste</button></div>' +
    '<ol class="liste-eleves">' + l.map(e => "<li>" + esc(e) + "</li>").join("") + "</ol></div>";
}
function renderValid() {
  const rs = state.requests.filter(r => r.status === "validee");
  const avenir = rs.filter(r => daysUntil(r.dateFin || r.dateDebut) >= 0).sort(byDate);
  const passees = rs.filter(r => !avenir.includes(r)).sort((a, b) => byDate(b, a));
  const ligne = r => reqRow(r, (interne(r) ? "dans l’établissement" : r.lieu || "") + " · " + r.author.name);
  return '<div class="page-head"><div><h1>Demandes validées</h1><p>Toutes les sorties, voyages et événements validés par la direction, pour information. Les décisions restent à la direction.</p></div></div>' +
    '<div class="tiles">' + tile(avenir.length, "à venir", "ok") + tile(passees.length, "passées", "") + "</div>" +
    listOf(avenir.map(ligne), "Aucune demande validée à venir.") +
    (passees.length ? '<h2 style="margin:18px 0 8px">Passées</h2>' + listOf(passees.map(ligne), "") : "");
}
function renderCal() {
  const rs = state.requests.filter(r => r.status !== "refusee" && r.status !== "brouillon" && r.dateDebut).sort(byDate);
  const groups = {};
  rs.forEach(r => { const k = r.dateDebut.slice(0, 7); (groups[k] = groups[k] || []).push(r); });
  const body = Object.keys(groups).sort().map(k => {
    const label = d(k + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return '<div class="month">' + esc(label[0].toUpperCase() + label.slice(1)) + "</div>" + listOf(groups[k].map(r => reqRow(r, interne(r) ? "dans l’établissement" + (r.lieu ? " (" + r.lieu + ")" : "") : "absents : " + (staffAcc(r).map(a => a.nom).join(", ") || "aucun"))), "");
  }).join("");
  return '<div class="page-head"><div><h1>Calendrier</h1><p>Sorties, voyages et événements transmis à la direction, mois par mois, avec les adultes absents de l’établissement.</p></div></div>' + (body || '<div class="card empty">Aucune sortie prévue.</div>');
}

/* ---------- Boîte à outils ---------- */
const CHECKLIST_REF = [
  ["Définir le projet", ["Déterminer les objectifs pédagogiques et éducatifs", "Identifier les enseignants et accompagnateurs responsables", "Choisir la destination et le programme détaillé"]],
  ["Budget et financement", ["Établir les devis : transport, hébergement, entrées, repas", "Préparer le budget à présenter à la direction", "Déterminer la participation financière des familles (part des accompagnateurs comprise)", "Prévoir les subventions ou aides possibles"]],
  ["Validation", ["Déposer la demande dans l’outil, avec les devis : elle remplace la fiche projet", "Attendre la décision du directeur de l’unité (prévenu automatiquement)", "Rédiger la circulaire d’information aux familles et la faire valider par la direction", "Vie scolaire : la date et les adultes absents lui sont transmis automatiquement"]],
  ["Réservations et logistique", ["Réserver le transport (car, train, avion)", "Réserver l’hébergement si nécessaire", "Réserver les activités et les visites", "Prendre rendez-vous avec Mme Berrami pour fixer le prélèvement ou l’échéancier", "Pour obtenir une réduction ou la gratuité, éditer une liste nominative des élèves à faire signer et tamponner par la direction (en prévoir plusieurs : certains sites la conservent)", "Paniers repas des demi-pensionnaires : le chef de cuisine est prévenu automatiquement à la validation (au moins trois semaines avant le départ)"]],
  ["Communication avec les familles", ["Envoyer la circulaire d’information", "Envoyer les autorisations parentales", "Récupérer les documents nécessaires (autorisations, PAI…)", "Pour les voyages, organiser une réunion d’information"]],
  ["Santé et sécurité", ["Après la déclaration de la sortie au rectorat par la direction, compléter les informations sur Arena", "Voyage à l’étranger : après la déclaration Ariane faite par la direction, en demander la copie", "Voyage : prévoir une trousse de secours et un responsable santé (à demander à la vie scolaire)", "Vérifier les fiches médicales des élèves (PAI, allergies, traitements)", "Voyage : fiche sanitaire remplie par la famille, sous enveloppe fermée au nom de l’élève avec la mention « secret médical » (à rendre au retour)", "Demander aux élèves d’avoir une pièce d’identité", "Pour certains pays, une autorisation de sortie de territoire est nécessaire", "Récupérer votre ordre de mission auprès de l’assistante de direction"]],
  ["Le jour J", ["Récupérer les paniers repas à la cantine entre 7 h 30 et 10 h (prévoir un temps de distribution)", "Vérifier la présence de tous les élèves et des documents (carte d’identité, passeport, sortie de territoire)", "Vérifier le matériel : billets, trousse de secours, programme", "Rappeler que le règlement intérieur s’applique pendant toute la sortie", "Donner aux accompagnateurs la liste des élèves dont ils ont la charge", "Faire l’appel sur École Directe ou signaler les absents à la direction"]],
  ["Retour et bilan", ["Vérifier que tous les élèves sont récupérés par leur famille ou autorisés à rentrer seuls", "Faire un débriefing avec les enseignants et les élèves", "Rédiger un bilan pour améliorer les prochaines sorties"]]
];
const RULES = [
  ["Encadrement", ["Une sortie est toujours encadrée par au moins un enseignant.", "Le nombre d’accompagnateurs dépend de l’âge des élèves, de la taille du groupe, de la durée et des risques du parcours : il est apprécié par la direction.", "Les adultes extérieurs (parents, bénévoles) doivent être autorisés par écrit par le chef d’établissement.", "Pour un voyage, l’identité complète des accompagnateurs extérieurs est demandée pour le contrôle d’honorabilité : sexe, nom de naissance, premier prénom, date et lieu de naissance."]],
  ["Transport", ["Le trajet aller-retour ne doit pas durer plus longtemps que l’activité elle-même.", "Car : entreprise inscrite au registre des transporteurs et conducteur professionnel ; la ceinture est obligatoire pour tous.", "Le conducteur ne compte jamais dans l’encadrement.", "Pour les longs trajets, le train ou l’avion sont à privilégier."]],
  ["Hébergement", ["Pour un séjour de plus de deux nuitées, privilégier une structure du catalogue national des structures d’accueil et d’hébergement (Éduscol).", "L’hébergement en famille d’accueil demande l’accord exprès des responsables légaux."]],
  ["Familles et autorisations", ["L’autorisation parentale est datée et signée ; la signature d’un seul parent suffit, sauf désaccord connu de l’autre.", "Les familles sont toujours informées avant la sortie.", "La participation des familles est un montant fixe par élève, au plus égal au coût par élève ; des facilités de paiement peuvent être proposées."]],
  ["Étranger", ["Chaque mineur présente une autorisation de sortie de territoire (formulaire sur service-public.fr), avec la copie de la pièce d’identité du signataire, valable un an au plus.", "Un enfant sous interdiction de sortie du territoire ne peut pas partir, même avec une autorisation.", "En Europe, recommander aux familles la carte européenne d’assurance maladie."]],
  ["Santé et inclusion", ["L’enseignant conserve les PAI et les médicaments pendant toute la sortie.", "Les informations médicales confidentielles sont confiées sous pli cacheté ; elles ne sont jamais saisies dans l’outil.", "Une trousse de secours accompagne chaque sortie.", "Les besoins des élèves en situation de handicap s’anticipent : transport, accompagnement, hébergement. Les frais supplémentaires ne sont jamais facturés à la famille.", "Un AESH ne peut accompagner un voyage qu’avec l’accord écrit de son employeur ; toute modification de son emploi du temps demande son accord."]]
];
function renderOutils() {
  const m = me();
  const sections = [["circuit", "Le circuit"], ["checklist", "Checklist"], ["regles", "Règles"], ["modeles", "Modèles"], ["pratique", "Infos pratiques"], ["contacts", "Contacts"]];
  const c = (id, t, body) => '<section class="card" id="sec-' + id + '"><h2>' + esc(t) + "</h2>" + body + "</section>";
  return '<div class="page-head"><div><h1>Boîte à outils</h1><p>Tout ce qu’il faut pour préparer une sortie ou un voyage au Protectorat, de l’idée au bilan.</p></div>' + (m.role !== "service" ? '<button class="btn primary" data-action="tab" data-view="new">Nouvelle demande</button>' : "") + "</div>" +
    '<nav class="toc" aria-label="Sommaire">' + sections.map(([id, l]) => '<button class="tab" data-action="scroll" data-target="sec-' + id + '">' + l + "</button>").join("") + "</nav>" +
    '<div class="stack">' +
    c("circuit", "Le circuit d’une demande", '<ol class="ref-list"><li>Vous déposez la demande avec vos devis et pièces jointes : elle remplace la fiche projet.</li><li>Le directeur de l’unité est prévenu par courriel : ' + esc(dirName("college")) + " pour le collège, " + esc(dirName("lycee")) + " pour le lycée et le pôle supérieur. " + esc(chefName()) + " est informé de chaque demande et peut arbitrer.</li><li>Il valide, demande des compléments ou refuse ; vous recevez sa décision par courriel.</li><li>Dès la validation, la comptabilité, la vie scolaire, le secrétariat et, s’il y a des demi-pensionnaires, le chef de cuisine sont prévenus automatiquement.</li><li>Vous suivez vos étapes dans l’outil et récupérez l’autorisation parentale pré-remplie.</li></ol>") +
    c("checklist", "Checklist d’organisation", '<p class="hint" style="margin-bottom:12px">Après validation, cette liste devient interactive dans votre demande, adaptée au type de sortie.</p><div class="ref-group">' + CHECKLIST_REF.map(([t, items]) => "<div><h3>" + esc(t) + "</h3><ul>" + items.map(i => "<li>" + esc(i) + "</li>").join("") + "</ul></div>").join("") + "</div>") +
    c("regles", "Règles à connaître", '<p class="hint" style="margin-bottom:12px">D’après le guide ministériel relatif aux sorties et voyages scolaires du second degré (octobre 2023), adapté au fonctionnement de l’établissement.</p><div class="ref-group">' + RULES.map(([t, items]) => "<div><h3>" + esc(t) + "</h3><ul>" + items.map(i => "<li>" + esc(i) + "</li>").join("") + "</ul></div>").join("") + "</div>") +
    c("modeles", "Modèles de documents", '<div class="stack"><div class="row between"><h3>Autorisation parentale</h3><button class="btn small" data-action="copy-auth" data-id="">Copier le modèle</button></div><p class="hint">Après validation, l’outil la pré-remplit avec le lieu, les dates et les transports de votre sortie.</p>' + autorisationDoc(null) + "</div>") +
    c("pratique", "Infos pratiques", '<div class="ref-group"><div><h3>Assurance scolaire</h3><ul><li>L’établissement a souscrit un contrat responsabilité civile et individuelle accident auprès de FIDES Assurances (Generali).</li><li>Il couvre les élèves et les personnels dans le cadre de leurs fonctions, pour toutes les sorties et tous les voyages scolaires, ainsi que les activités des bénévoles de l’APEL.</li><li>À l’étranger, inviter les familles à vérifier les conditions de rapatriement.</li></ul></div>' +
      "<div><h3>Restauration et paniers repas</h3><ul><li>Les repas sont préparés sur place par les équipes de cuisine, avec le prestataire Sodexo.</li><li>Les paniers repas des demi-pensionnaires se commandent au moins trois semaines avant le départ : l’outil prévient le chef de cuisine dès la validation.</li><li>Retrait à la cantine entre 7 h 30 et 10 h, le jour de la sortie.</li></ul></div>" +
      "<div><h3>Adresse de l’établissement</h3><ul><li>" + esc(ETAB.nom) + ", " + esc(ETAB.statut.toLowerCase()) + "</li><li>" + esc(ETAB.adresse) + "</li><li>Utile pour les listes nominatives, les réservations et les devis.</li></ul></div>" +
      "<div><h3>Financement</h3><ul><li>Pistes : participation des familles, budget pédagogique, taxe d’apprentissage, APEL.</li><li>La répartition est arrêtée par la direction au moment de la validation.</li><li>Le coût des accompagnateurs est intégré au coût par élève.</li></ul></div></div>") +
    c("contacts", "Contacts", kv([["Direction du collège", dirName("college")], ["Direction du lycée et du pôle supérieur", dirName("lycee")], ["Chef d’établissement", chefName()], ["Comptabilité", "Mme Berrami : prélèvement et échéancier"], ["Vie scolaire", "emploi du temps, responsable santé des voyages"], ["Assistante de direction", "ordres de mission"], ["Chef de cuisine", "paniers repas"], ["Accueil", ETAB.tel + " · " + ETAB.mail + ", " + ETAB.horaires]]) + '<p style="margin-top:12px"><a href="' + ETAB.site + '" target="_blank" rel="noopener">Site de l’établissement</a></p>') +
    "</div>";
}

/* ---------- Détail d'une demande ---------- */
function renderDetail(r) {
  const m = me(), s = STATUS[r.status] || STATUS.brouillon, t = totals(r);
  const dir = dirOf(r) || { nom: "à déterminer", titre: "selon l’unité choisie" };
  const isAuthor = m.email === r.author.email;
  const isDir = m.role === "directeur" && m.unites.includes(r.unite);
  const isChef = m.role === "chef";
  const back = isAuthor ? "mine" : ({ directeur: r.status === "soumise" ? "todo" : "all", chef: "all", service: r.taches && m.service in r.taches ? "svc" : "valid" }[m.role] || "mine");
  const dis = state.busy ? " disabled" : "";
  let h = '<div class="detail-grid">';
  h += '<div><button class="link" data-action="tab" data-view="' + back + '">Retour à la liste</button></div>';
  h += '<div class="card d-head"><div class="row between"><span class="hint">' + esc(code(r)) + " · déposée par " + esc(r.author.name) + '</span><span class="pill ' + s.cls + '">' + s.label + "</span></div><h1>" + esc(r.titre || "Sans titre") + "</h1>" +
    '<div class="row"><span class="chip">' + esc(unitLabel(r)) + '</span><span class="chip">' + esc((TYPES[r.type] || TYPES.sortie).chip) + "</span>" + (interne(r) ? "" : '<span class="chip">' + (r.destination === "etranger" ? "Étranger : " + esc(r.pays || "pays à préciser") : "France") + "</span>") + "</div>" +
    "<p><strong>" + esc(dateRange(r)) + "</strong>" + esc(horaires(r)) + " · " + esc(r.lieu || "lieu à préciser") + "</p>" +
    '<p class="hint">Décision : ' + esc(dir.nom) + (dir.titre ? " (" + esc(dir.titre.toLowerCase()) + ")" : "") + " · consultation et arbitrage : " + esc(chefName()) + "</p></div>";

  const last = [...r.historique].reverse().find(x => x.comment);
  if (isAuthor && r.status === "complements") h += '<div class="card" style="border:2px solid var(--info)"><h2>Compléments demandés</h2>' + (last ? "<p><strong>" + esc(last.who) + "</strong> : « " + esc(last.comment) + " »</p>" : "") + '<div class="actions" style="margin-top:12px"><button class="btn primary" data-action="edit" data-id="' + r.id + '">Compléter ma demande</button></div></div>';
  if (isAuthor && r.status === "brouillon") h += '<div class="card"><h2>Brouillon</h2><p class="hint">Cette demande n’a pas encore été transmise à la direction.</p><div class="actions" style="margin-top:12px"><button class="btn primary" data-action="edit" data-id="' + r.id + '">Reprendre et soumettre</button><button class="btn danger" data-action="delete-draft" data-id="' + r.id + '"' + dis + ">Supprimer le brouillon</button></div></div>";
  if (r.status === "refusee" && last) h += '<div class="card" style="border:2px solid var(--bad)"><h2>Demande non retenue</h2><p><strong>' + esc(last.who) + "</strong> : « " + esc(last.comment) + " »</p></div>";

  if (isDir && r.status === "soumise") h += renderDecision(r);
  if (isChef && r.status !== "brouillon") h += renderChefPanel(r, dir);
  if (m.role === "service" && r.taches && m.service in r.taches) {
    const svc = m.service;
    h += '<div class="card decision"><h2>Pour vous : ' + esc(SERVICES[svc].task.toLowerCase()) + "</h2>" + svcDetails(r, svc) + '<div class="actions" style="margin-top:14px"><button class="btn ' + (r.taches[svc] ? "" : "ok") + '" data-action="task" data-id="' + r.id + '" data-fait="' + (r.taches[svc] ? "0" : "1") + '"' + dis + ">" + (r.taches[svc] ? "Marquer comme non fait" : "Marquer comme fait") + "</button></div></div>";
  }
  const vig = m.role === "service" ? [] : vigilance(r);
  if (vig.length) h += '<div class="card"><h2>' + (isAuthor ? "Points à anticiper" : "Points de vigilance") + "</h2>" + renderVig(vig) + "</div>";

  if (r.status === "validee" && r.taches) {
    h += '<div class="card"><h2>Suivi par les services</h2><ul class="svc-list">' + Object.keys(r.taches).filter(k => SERVICES[k]).map(k => "<li><span><strong>" + esc(SERVICES[k].label) + '</strong><br><span class="hint">' + esc(SERVICES[k].task) + '</span></span><span class="pill ' + (r.taches[k] ? "ok-c" : "warn-c") + '">' + (r.taches[k] ? "Fait" : "À faire") + "</span></li>").join("") + "</ul></div>";
    if ((isDir || isChef) && checklistDir(r).length) {
      const items = checklistDir(r), done = items.filter(i => r.checkDir[i[0]]).length;
      h += '<div class="card"><div class="row between"><h2>Suivi de la direction</h2><span class="hint" data-count>' + done + " sur " + items.length + '</span></div><ul class="check-list">' + items.map(([id, txt]) => '<li class="' + (r.checkDir[id] ? "done" : "") + '"><label><input type="checkbox" id="dir-' + id + '" data-action="check" data-list="etape_direction" data-id="' + r.id + '" data-item="' + id + '"' + (r.checkDir[id] ? " checked" : "") + "><span>" + esc(txt) + "</span></label></li>").join("") + "</ul></div>";
    }
  }
  if (isAuthor && r.status === "validee") {
    const phases = checklistFor(r);
    const all = phases.flatMap(p => p[1]);
    const done = all.filter(i => i[2] || r.checklist[i[0]]).length;
    h += '<div class="card"><div class="row between"><h2>Mes étapes</h2><span class="hint" data-count>' + done + " sur " + all.length + "</span></div>" +
      phases.map(([title, items]) => '<div class="phase">' + esc(title) + '</div><ul class="check-list">' + items.map(([id, txt, auto]) => {
        const on = auto || r.checklist[id];
        return '<li class="' + (on ? "done" : "") + '"><label><input type="checkbox" id="chk-' + id + '" data-action="check" data-list="etape" data-id="' + r.id + '" data-item="' + id + '"' + (on ? " checked" : "") + (auto ? " disabled" : "") + "><span>" + esc(txt) + "</span>" + (auto ? '<span class="auto-tag">fait par l’outil</span>' : "") + "</label></li>";
      }).join("") + "</ul>").join("") + "</div>";
    if (!interne(r)) h += '<div class="card"><div class="row between"><h2>Autorisation parentale pré-remplie</h2><button class="btn small" data-action="copy-auth" data-id="' + r.id + '">Copier le texte</button></div><p class="hint" style="margin:4px 0 12px">Lieu, dates et transports sont repris de la demande. Copiez le texte dans votre traitement de texte pour l’imprimer.</p>' + autorisationDoc(r) + "</div>";
  }

  if (r.observations && m.role !== "service") h += '<div class="card" style="border-left:4px solid var(--accent)"><h2>Observations de l’organisateur</h2><p class="hint" style="margin-bottom:8px">Destinées à la direction.</p><p style="white-space:pre-line">' + esc(r.observations) + "</p></div>";
  h += '<div class="card"><h2>Le projet</h2>' + kv([["Objectifs", r.objectifs], ["Disciplines", r.disciplines]].concat(r.intervenant ? [["Intervenant", r.intervenant]] : [])) + "</div>";
  h += '<div class="card"><h2>Organisation</h2>' + kv(interne(r)
    ? [["Date", dateRange(r)], ["Horaires", horairesTexte(r)], ["Lieu dans l’établissement", r.lieu], ["Besoins techniques", besoinsTexte(r)], ["Précisions techniques", (r.technique || {}).precisions || ""]]
    : [["Date(s)", dateRange(r)], ["Horaires", horairesTexte(r)], ["Rendez-vous", r.rdv], ["Lieu", r.lieu], ["Transports", (r.transports || []).join(", ")]].concat(r.type === "voyage" ? [["Hébergement", r.hebergement]] : [])) + "</div>";
  const nAcc = (r.accompagnateurs || []).length;
  h += '<div class="card"><h2>Élèves et encadrement</h2>' + kv([["Classes", r.classes], ["Élèves", plural(num(r.nbEleves), "élève")], ["Participation", r.classeEntiere ? "toute la classe" : "une partie des élèves seulement (liste nominative)"]].concat(interne(r) ? [["Paniers repas", repasAPrevoir(r) ? plural(num(r.nbDP), "panier") + " préparés par le chef de cuisine" : "aucun"]] : [["Demi-pensionnaires", r.sansRepas ? "aucun repas à prévoir par la restauration" : plural(num(r.nbDP), "élève")]], [["Besoins particuliers", r.besoins ? "oui (PAI, PPS ou AESH)" : "non signalés"], ["Encadrement", nAcc ? encadrement(nAcc, num(r.nbEleves)) : "aucun accompagnateur"]])) +
    (nAcc ? '<div class="tbl-wrap" style="margin-top:12px"><table class="t"><thead><tr><th>Accompagnateur</th><th>Qualité</th></tr></thead><tbody>' + r.accompagnateurs.map(a => "<tr><td>" + esc(a.nom) + "</td><td>" + esc(QUALITES[a.qualite] || a.qualite) + "</td></tr>").join("") + "</tbody></table></div>" : "") + blocEleves(r) + "</div>";
  const depRows = DEPENSES.filter(([k]) => num((r.depenses || {})[k]) > 0);
  h += '<div class="card"><h2>Budget</h2><div class="tbl-wrap"><table class="t"><thead><tr><th>Dépense</th><th class="r">Montant</th></tr></thead><tbody>' +
    (depRows.length ? depRows.map(([k, l]) => "<tr><td>" + l + '</td><td class="r money">' + eur(num(r.depenses[k])) + "</td></tr>").join("") : '<tr><td colspan="2" class="hint">Aucune dépense pour les élèves.</td></tr>') +
    (t.accomp > 0 ? '<tr><td>Part des accompagnateurs</td><td class="r money">' + eur(t.accomp) + "</td></tr>" : "") +
    '</tbody><tfoot><tr><td>Coût total</td><td class="r money">' + eur(t.total) + "</td></tr></tfoot></table></div>" +
    '<div class="live" style="margin-top:14px"><div><span class="hint">Coût par élève</span><strong>' + eur(t.parEleve) + '</strong></div><div><span class="hint">Participation proposée</span><strong>' + eur(num(r.participation)) + "</strong></div></div>" +
    (r.financement ? '<p style="margin-top:12px"><strong>Financement arrêté par la direction (par élève) :</strong> ' + esc(FIN.filter(([k]) => num(r.financement[k]) > 0).map(([k, l]) => l + " " + eur(num(r.financement[k]))).join(" · ") || "aucun") + "</p>" : "") + "</div>";
  h += '<div class="card"><h2>Pièces jointes</h2>' + ((r.pieces || []).length ? '<ul class="file-list">' + r.pieces.map(p => "<li><span>" + (r.liens[p.chemin] ? '<a class="file-link" href="' + esc(r.liens[p.chemin]) + '" target="_blank" rel="noopener">' + esc(p.nom) + "</a>" : esc(p.nom)) + '</span><span class="chip">Fichier</span></li>').join("") + "</ul>" : '<p class="hint">Aucune pièce jointe.</p>') + "</div>";
  h += '<div class="card"><h2>Historique</h2>' + (r.historique.length ? '<ol class="timeline">' + [...r.historique].reverse().map(x => '<li><span class="dot" aria-hidden="true"></span><div><div class="when">' + esc(stamp(x.date)) + "</div><div><strong>" + esc(x.who) + "</strong> · " + esc(x.action) + "</div>" + (x.comment ? "<q>" + esc(x.comment) + "</q>" : "") + "</div></li>").join("") + "</ol>" : '<p class="hint">Rien pour le moment : la demande n’a pas encore été transmise.</p>') + "</div>";
  return h + "</div>";
}
function renderDecision(r) {
  const t = totals(r), part = num(r.participation), dis = state.busy ? " disabled" : "";
  const pre = { familles: part, budgetPeda: Math.max(0, Math.round((t.parEleve - part) * 100) / 100) };
  return '<section class="card decision stack" id="decision"><div><h2>Votre décision</h2><p class="hint">Comme sur la fiche projet, indiquez le financement par élève. Le coût par élève, accompagnateurs compris, est de ' + eur(t.parEleve) + ".</p></div>" +
    '<div class="grid3">' + FIN.map(([k, l]) => '<div class="field"><label for="fin-' + k + '">' + l + ' (€ par élève)</label><input id="fin-' + k + '" type="number" inputmode="decimal" min="0" step="0.01" data-fin="' + k + '" value="' + (pre[k] ? pre[k] : "") + '"></div>').join("") + "</div>" +
    '<p id="fin-sum" class="hint" data-cost="' + t.parEleve + '"></p>' +
    '<div class="field"><label for="dec-comment">Commentaire pour ' + esc(r.author.name) + '</label><textarea id="dec-comment" placeholder="Obligatoire pour demander des compléments ou refuser."></textarea><span class="err" id="dec-err"></span></div>' +
    '<div class="actions"><button class="btn ok" data-action="decide" data-decision="validee" data-id="' + r.id + '"' + dis + '>Valider la demande</button><button class="btn info" data-action="decide" data-decision="complements" data-id="' + r.id + '"' + dis + '>Demander des compléments</button><button class="btn danger" data-action="decide" data-decision="refusee" data-id="' + r.id + '"' + dis + ">Refuser</button></div>" +
    '<p class="hint">Après validation, ' + esc(r.author.name) + ", " + servicesNoms(r) + (repasAPrevoir(r) ? " (" + plural(num(r.nbDP), "panier") + " repas)" : "") + " reçoivent un courriel. " + esc(chefName()) + " est en copie.</p></section>";
}
function renderChefPanel(r, dir) {
  const dis = state.busy ? " disabled" : "";
  return '<section class="card stack" id="chef-panel" style="border:2px solid var(--accent)"><div><h2>Consultation et arbitrage</h2><p class="hint">La décision revient à ' + esc(dir.nom) + ". Vous pouvez lui transmettre un avis, ou trancher vous-même : votre arbitrage remplace sa décision et chacun en est informé.</p></div>" +
    '<div class="field"><label for="avis-comment">Avis transmis à ' + esc(dir.nom) + '</label><textarea id="avis-comment"></textarea><span class="err" id="avis-err"></span></div>' +
    '<div class="actions"><button class="btn" data-action="avis" data-id="' + r.id + '"' + dis + '>Envoyer mon avis</button></div><hr style="margin:4px 0">' +
    '<div class="field"><label for="arb-decision">Arbitrage</label><select id="arb-decision">' +
    [["validee", "Valider la demande"], ["complements", "Renvoyer à " + r.author.name + " pour compléments"], ["refusee", "Refuser la demande"]]
      .filter(([v]) => v !== r.status).map(([v, l]) => '<option value="' + v + '">' + esc(l) + "</option>").join("") + "</select>" +
    '<span class="hint">' + (r.status === "validee" ? "Un renvoi pour compléments suspend la validation : les services en sont prévenus."
      : r.status === "complements" ? "Des compléments sont déjà demandés : la demande est chez " + esc(r.author.name) + "."
      : "Après un renvoi pour compléments, la demande complétée repasse par la décision de " + esc(dir.nom) + ".") + "</span></div>" +
    '<div class="field"><label for="arb-comment">Motif de l’arbitrage</label><textarea id="arb-comment" placeholder="Transmis à l’organisateur et au directeur de l’unité. Pour un renvoi, précisez les compléments attendus."></textarea><span class="err" id="arb-err"></span></div>' +
    '<div class="actions"><button class="btn primary" data-action="arbitrate" data-id="' + r.id + '"' + dis + ">Arbitrer</button></div></section>";
}
function autorisationText(r) {
  const lieu = r ? r.lieu : "……………………", dates = r ? dateRange(r) + horaires(r) : "……………………";
  const tr = r ? ((r.transports || []).join(", ").toLowerCase() || "à préciser") : "……………………";
  return "SORTIE SCOLAIRE\nAUTORISATION PARENTALE\n\nJe, soussigné(e),\nNom : ……………………  Prénom : ……………………\nAdresse : ………………………………………………\nTéléphone : ……………………\n\nResponsable légal de l’enfant\nNom et prénom : ……………………  Classe : ………\n\nAutorise celui-ci à prendre part à la sortie organisée par le Protectorat Saint-Joseph\nLieux : " + lieu + "\nDate(s) : " + dates + "\net à utiliser les modes de transports suivants : " + tr + "\n\n– J’ai pris connaissance de toutes les activités proposées et des moyens de transports utilisés.\n– Je certifie que l’enfant (nom et prénom) ……………………… n’a pas de problèmes de santé particuliers empêchant la participation à la sortie.\n\nEn cas contraire : je vous fournis ici un certificat médical précisant que l’enfant est inapte à suivre les activités prévues dont j’ai pris connaissance.\nEn cas de traitement pendant la sortie : je joins l’ordonnance aux médicaments.\n\nJe déclare exacts les renseignements portés sur cette fiche et j’autorise également les accompagnateurs responsables à prendre toutes les décisions pour des soins, pour une hospitalisation, pour une intervention chirurgicale en cas de nécessité constatée par un médecin.\n\nÀ ……………………  Le ……………………\nSignature\n\nPROTECTORAT SAINT-JOSEPH";
}
function autorisationDoc(r) {
  const f = v => r ? '<span class="fill">' + esc(v) + "</span>" : "……………………";
  const tr = r ? ((r.transports || []).join(", ").toLowerCase() || "à préciser") : "";
  return '<div class="doc"><h3>Sortie scolaire</h3><p class="center"><strong>Autorisation parentale</strong></p><p>Je, soussigné(e), Nom : …………… Prénom : ……………<br>Adresse : ………………………… Téléphone : ……………</p><p><strong>Responsable légal de l’enfant</strong><br>Nom et prénom : …………………… Classe : ………</p>' +
    "<p>Autorise celui-ci à prendre part à la sortie organisée par le Protectorat Saint-Joseph<br>Lieux : " + f(r && r.lieu) + "<br>Date(s) : " + f(r && dateRange(r) + horaires(r)) + "<br>et à utiliser les modes de transports suivants : " + f(tr) + "</p>" +
    "<ul><li>J’ai pris connaissance de toutes les activités proposées et des moyens de transports utilisés.</li><li>Je certifie que l’enfant (nom et prénom) …………… n’a pas de problèmes de santé particuliers empêchant la participation à la sortie.</li></ul>" +
    "<p>En cas contraire : je vous fournis ici un <strong>certificat médical</strong> précisant que l’enfant est inapte à suivre les activités prévues dont j’ai pris connaissance. En cas de traitement pendant la sortie : je joins l’ordonnance aux médicaments.</p>" +
    "<p><em>Je déclare exacts les renseignements portés sur cette fiche et j’autorise également les accompagnateurs responsables à prendre toutes les décisions pour des soins, pour une hospitalisation, pour une intervention chirurgicale en cas de nécessité constatée par un médecin.</em></p>" +
    '<p>À …………………… Le ……………………</p><p style="text-align:right">Signature</p><p class="center"><strong>PROTECTORAT SAINT-JOSEPH</strong></p></div>';
}

/* ---------- Formulaire ---------- */
let accSeq = 0;
function accRow(a) {
  a = a || { nom: "", qualite: "enseignant" };
  const n = accSeq++;
  return '<div class="acc-row"><input type="text" id="acc-' + n + '-nom" data-k="nom" aria-label="Nom et prénom de l’accompagnateur" placeholder="Nom et prénom" value="' + esc(a.nom) + '">' +
    '<select id="acc-' + n + '-qualite" data-k="qualite" aria-label="Qualité de l’accompagnateur">' + Object.entries(QUALITES).map(([k, l]) => '<option value="' + k + '"' + (a.qualite === k ? " selected" : "") + ">" + l + "</option>").join("") + "</select>" +
    '<button type="button" class="btn small ghost" data-action="del-acc">Retirer</button></div>';
}
function fld(id, label, val, o) {
  o = o || {};
  const attrs = (o.min != null ? ' min="' + o.min + '"' : "") + (o.step ? ' step="' + o.step + '"' : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "");
  const ctl = o.area ? '<textarea id="' + id + '" name="' + id + '"' + attrs + ">" + esc(val) + "</textarea>" : '<input id="' + id + '" name="' + id + '" type="' + (o.type || "text") + '" value="' + esc(val == null ? "" : val) + '"' + attrs + ">";
  return '<div class="field"' + (o.if ? ' data-if="' + o.if + '"' : "") + '><label for="' + id + '">' + label + (o.req ? ' <span class="req-star" aria-hidden="true">*</span>' : "") + "</label>" + ctl + (o.hint ? '<span class="hint">' + o.hint + "</span>" : "") + '<span class="err" id="err-' + id + '"></span></div>';
}
function radios(name, label, opts, val) {
  return '<div class="seg" role="radiogroup" aria-label="' + esc(label) + '">' + opts.map(([v, l, h]) => '<label class="choice" for="' + name + "-" + v + '"><input type="radio" name="' + name + '" id="' + name + "-" + v + '" value="' + v + '"' + (val === v ? " checked" : "") + '><span><span class="choice-l">' + l + "</span>" + (h ? '<span class="hint">' + h + "</span>" : "") + "</span></label>").join("") + "</div>";
}
function money(v) { return num(v) > 0 ? num(v) : ""; }
function renderForm(r) {
  const m = me();
  const x = r || mk({ accompagnateurs: [{ nom: m.name, qualite: "enseignant" }] });
  if (!state.formReady || state.formReady !== (r ? "edit-" + r.id : "new")) {
    state.formPieces = [...(x.pieces || [])]; state.formFiles = []; state.formRemoved = []; state.formReady = r ? "edit-" + r.id : "new";
  }
  accSeq = 0;
  const title = r ? (r.status === "complements" ? "Compléter la demande " + code(r) : "Reprendre le brouillon " + code(r)) : "Nouvelle demande";
  const lastCom = r && r.status === "complements" ? [...r.historique].reverse().find(h => h.comment) : null;
  const dis = state.busy ? " disabled" : "";
  let h = '<div class="page-head"><div><h1>' + esc(title) + "</h1><p>Ce formulaire remplace la fiche projet. Les champs marqués d’un astérisque sont nécessaires pour soumettre ; vous pouvez enregistrer un brouillon à tout moment.</p></div></div>";
  if (lastCom) h += '<div class="callout" style="margin-bottom:16px;border-color:var(--info)"><strong>Demande de ' + esc(lastCom.who) + " :</strong> « " + esc(lastCom.comment) + " »</div>";
  if (!r) h += '<div class="callout" style="margin-bottom:16px"><strong>Avant de commencer, munissez-vous :</strong> de vos objectifs et du programme, des devis (transport, entrées, hébergement), de la liste des accompagnateurs et du nombre de demi-pensionnaires. <button class="link" data-action="tab" data-view="outils">Ouvrir la boîte à outils</button></div>';
  h += '<div class="flash err-flash hidden" id="form-errors" role="alert"></div>';
  h += '<form class="req" id="req-form" novalidate>';
  h += '<fieldset><legend>1. Cadre de la demande</legend>' +
    '<div class="field"><span class="label">Unité concernée <span class="req-star" aria-hidden="true">*</span></span>' + radios("unite", "Unité concernée", Object.entries(UNITES).map(([k, u]) => [k, u.label, u.hint || ""]), x.unite) + '<span class="hint" id="unit-dir"></span><span class="err" id="err-unite"></span></div>' +
    '<div class="field"><span class="label">Type</span>' + radios("type", "Type", Object.entries(TYPES).map(([k, t]) => [k, t.label, t.hint]), x.type) + "</div>" +
    '<div class="field" data-if="dehors"><span class="label">Destination</span>' + radios("destination", "Destination", [["france", "France"], ["etranger", "Étranger"]], x.destination) + "</div>" +
    fld("pays", "Pays", x.pays, { if: "etranger", req: true, hint: "Chaque mineur devra présenter une autorisation de sortie de territoire et une pièce d’identité." }) + "</fieldset>";
  h += '<fieldset><legend>2. Le projet</legend>' + fld("titre", "Intitulé", x.titre, { req: true, ph: "Ex. : Visite de l’exposition sur le corps humain" }) + fld("lieu", "Lieu(x)", x.lieu, { req: true, ph: "Ex. : Cité des sciences et de l’industrie, Paris 19e", hint: '<span data-if="etablissement">Pour un événement dans l’établissement : la salle (gymnase, CDI, salle polyvalente…).</span>' }) +
    fld("objectifs", "Objectifs pédagogiques", x.objectifs, { area: true, req: true }) + fld("disciplines", "Disciplines concernées", x.disciplines, { ph: "Ex. : histoire, français" }) +
    fld("intervenant", "Intervenant ou prestataire extérieur", x.intervenant, { if: "etablissement", ph: "Ex. : compagnie Drama Ties", hint: "Laissez vide si l’événement est animé par l’équipe de l’établissement." }) + "</fieldset>";
  h += '<fieldset><legend>3. Dates et horaires</legend><div class="grid2">' + fld("dateDebut", "Date (ou date de départ)", x.dateDebut, { type: "date", req: true }) + fld("dateFin", "Date de retour", x.dateFin, { type: "date", if: "voyage", req: true }) + "</div>" +
    '<div class="grid3">' + fld("heureDepart", "Heure de départ", x.heureDepart, { type: "time", req: true }) + fld("heureRetour", "Heure de retour", x.heureRetour, { type: "time", req: true }) + fld("rdv", "Lieu de rendez-vous", x.rdv, { ph: "Ex. : gare RER d’Aulnay", if: "dehors" }) + "</div></fieldset>";
  h += '<fieldset><legend>4. Élèves</legend>' + fld("classes", "Classe(s)", x.classes, { req: true, ph: "Ex. : 3e A, 3e B" }) + '<div class="grid2">' + fld("nbEleves", "Nombre d’élèves", x.nbEleves || "", { type: "number", min: 1, req: true, mode: "numeric" }) +
    fld("nbDP", "Dont demi-pensionnaires", x.nbDP || "", { type: "number", min: 0, mode: "numeric", if: "repas", req: true, hint: "Le chef de cuisine sera prévenu pour les paniers repas." }) + "</div>" +
    '<div class="field"><span class="label">Participation</span>' + radios("participation", "Participation", [["classe", "Toute la classe", "ou toutes les classes indiquées"], ["partielle", "Une partie des élèves", "liste nominative à joindre"]], x.classeEntiere === false ? "partielle" : "classe") + "</div>" +
    fld("eleves", "Liste des élèves participants", (x.eleves || []).join("\n"), { area: true, req: true, if: "partielle", ph: "DUPONT Léa – 4e A\nMARTIN Hugo – 4e B",
      hint: "Copiez les élèves depuis École Directe et collez-les ici : un élève par ligne, avec sa classe. Seules la direction, la vie scolaire et la comptabilité verront cette liste." }) +
    '<p class="hint" id="eleves-compte" data-if="partielle" aria-live="polite"></p>' +
    '<label class="inline" for="paniersEvt" data-if="etablissement"><input type="checkbox" id="paniersEvt"' + (interne(x) && !x.sansRepas ? " checked" : "") + "> <span>Des paniers repas sont à prévoir par le chef de cuisine (par exemple pour un pique-nique pris avec des élèves extérieurs)</span></label>" +
    '<label class="inline" for="sansRepas" data-if="dehors"><input type="checkbox" id="sansRepas" name="sansRepas"' + (x.sansRepas ? " checked" : "") + "> <span>Aucun repas à prévoir par le service de restauration (pique-nique fourni par les familles, repas sur place, retour avant le déjeuner…)</span></label>" +
    '<label class="inline" for="besoins"><input type="checkbox" id="besoins" name="besoins"' + (x.besoins ? " checked" : "") + "> <span>Des élèves ont des besoins particuliers (PAI, PPS, accompagnement AESH)</span></label>" +
    '<p class="tip" data-if="dehors"><span>Pensez à vérifier les PAI et renseignez-vous auprès du bureau de la vie scolaire pour les récupérer et les avoir avec vous pendant la sortie.</span></p></fieldset>';
  h += '<fieldset><legend id="leg-acc">5. Accompagnateurs</legend><p class="hint">Indiquez tous les adultes, vous compris. La vie scolaire et le secrétariat s’en servent pour l’emploi du temps et les ordres de mission.</p><div class="stack" id="acc-list" style="gap:10px">' + (x.accompagnateurs.length ? x.accompagnateurs : [null]).map(accRow).join("") +
    '</div><span class="err" id="err-acc"></span><div><button type="button" class="btn small" data-action="add-acc">Ajouter un accompagnateur</button></div><p class="hint" id="ratio"></p>' +
    '<p class="tip"><span>Les parents d’élèves peuvent être accompagnateurs : ajoutez-les avec la qualité « Parent d’élève ».</span></p></fieldset>';
  h += '<fieldset data-if="dehors"><legend>6. Transport et hébergement</legend><div class="field"><span class="label">Modes de transport <span class="req-star" aria-hidden="true">*</span></span><div class="checks">' + TRANSPORTS.map((t, i) => '<label class="check-pill" for="tr-' + i + '"><input type="checkbox" id="tr-' + i + '" name="transports" value="' + esc(t) + '"' + ((x.transports || []).includes(t) ? " checked" : "") + "> " + esc(t) + "</label>").join("") +
    '<label class="check-pill" for="tr-autre"><input type="checkbox" id="tr-autre"' + (autresTransports(x).length ? " checked" : "") + "> Autre</label>" + '</div><span class="err" id="err-transports"></span></div>' +
    fld("trAutre", "Autre mode de transport", autresTransports(x).filter(t => t !== "Autre").join(", "), { if: "tr-autre", req: true, ph: "Ex. : vélo, bateau, minibus" }) +
    fld("hebergement", "Hébergement", x.hebergement, { if: "voyage", ph: "Structure, adresse, type d’accueil", hint: "Au-delà de deux nuitées, privilégier une structure du catalogue national (Éduscol)." }) + "</fieldset>";
  const tech = x.technique || {};
  h += '<fieldset data-if="etablissement"><legend>6. Lieu et besoins techniques</legend><p class="hint">Transmis au service technique à la validation, avec la date, les horaires, le lieu et l’effectif.</p>' +
    '<div class="field"><span class="label">Besoins</span><div class="checks">' + BESOINS_TECH.map(([k, l, d]) => '<label class="inline" for="tech-' + k + '"><input type="checkbox" id="tech-' + k + '"' + (tech[k] ? " checked" : "") + "> <span>" + esc(l) + ' <span class="hint">(' + esc(d) + ")</span></span></label>").join("") + "</div></div>" +
    fld("techPrecisions", "Précisions pour le service technique", tech.precisions || "", { area: true, ph: "Ex. : 130 chaises en rangs face à la scène, espace scénique de 6 m × 4 m, deux micros sans fil, branchement d’un ordinateur portable, installation à partir de 9 h 30…", hint: "Aménagement souhaité, matériel, horaires d’installation et de rangement, accès pour l’intervenant." }) + "</fieldset>";
  h += '<fieldset><legend>7. Budget</legend><p class="hint">D’après les devis. Le coût des accompagnateurs est intégré au coût par élève.</p><div class="grid3">' +
    DEPENSES.map(([k, l]) => fld("dep-" + k, l + " (€)", money((x.depenses || {})[k]), { type: "number", min: 0, step: "0.01", mode: "decimal", if: "dep-" + k })).join("") +
    fld("coutAccomp", "Part des accompagnateurs (€)", money(x.coutAccomp), { type: "number", min: 0, step: "0.01", mode: "decimal", if: "dehors", hint: "Transport, entrées, hébergement des adultes." }) + "</div>" +
    '<div class="callout live"><div><span class="hint">Coût total</span><strong id="live-total">0 €</strong></div><div><span class="hint">Coût par élève</span><strong id="live-per">–</strong></div></div>' +
    fld("participation", "Participation demandée par famille (€)", money(x.participation), { type: "number", min: 0, step: "0.01", mode: "decimal", hint: "Montant fixe par élève, au plus égal au coût par élève. La répartition finale (familles, budget pédagogique, taxe d’apprentissage, APEL) est arrêtée par la direction." }) +
    fld("reglement", "Modalités de règlement du prestataire", x.reglement, { area: true, ph: "Ex. : règlement après la prestation, sur facture accompagnée d’un RIB, sous 30 jours ; aucun acompte", hint: "Transmises à la comptabilité avec la validation." }) + "</fieldset>";
  h += '<fieldset><legend>8. Devis et pièces jointes</legend><div class="field"><label for="devis-input">Ajouter des fichiers</label><input type="file" id="devis-input" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.odt"><span class="hint">Devis, programme, documents du prestataire : 10 Mo au plus par fichier. Ils sont enregistrés avec la demande.</span><span class="err" id="err-devis"></span></div><ul class="file-list" id="devis-list"></ul></fieldset>';
  h += '<fieldset><legend>9. Observations pour la direction</legend>' + fld("observations", "Observations", x.observations, { area: true, ph: "Contexte, contraintes, logistique, points à arbitrer, échanges déjà engagés…", hint: "Facultatif. Lues par la direction avec la demande ; les services ne les voient pas. Aucune donnée médicale ni information sensible sur un élève." }) + "</fieldset>";
  h += '<div class="card"><h2>Ce que la direction verra</h2><p class="hint" style="margin-bottom:10px">Ces points se mettent à jour pendant la saisie.</p><div id="live-vig"></div></div>';
  h += '<div class="form-actions"><span class="hint" id="submit-hint"></span><button type="button" class="btn" data-action="save-draft"' + dis + ">" + (state.busy ? "Enregistrement…" : "Enregistrer le brouillon") + '</button><button type="button" class="btn primary" data-action="submit-req"' + dis + ">" + (state.busy ? "Envoi…" : (r && r.status === "complements" ? "Renvoyer à la direction" : "Soumettre à la direction")) + "</button></div></form>";
  return h;
}
function radioVal(f, name) { const el = f.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
function readForm() {
  const f = $("#req-form");
  const g = id => { const el = f.querySelector("#" + id); return el ? el.value.trim() : ""; };
  const type = radioVal(f, "type") || "sortie", dest = radioVal(f, "destination") || "france";
  const acc = $$(".acc-row", f).map(row => ({ nom: row.querySelector('[data-k="nom"]').value.trim(), qualite: row.querySelector('[data-k="qualite"]').value })).filter(a => a.nom);
  const dep = {};
  const dedans = type === "etablissement";
  DEPENSES.forEach(([k]) => { const v = depVisible(k, type) ? num(g("dep-" + k)) : 0; if (v > 0) dep[k] = v; });
  return { unite: radioVal(f, "unite"), type, destination: dedans ? "france" : dest, pays: !dedans && dest === "etranger" ? g("pays") : "",
    titre: g("titre"), lieu: g("lieu"), objectifs: g("objectifs"), disciplines: g("disciplines"),
    dateDebut: g("dateDebut"), dateFin: type === "voyage" ? g("dateFin") : "", heureDepart: g("heureDepart"), heureRetour: g("heureRetour"), rdv: dedans ? "" : g("rdv"),
    classes: g("classes"), classeEntiere: radioVal(f, "participation") !== "partielle", eleves: radioVal(f, "participation") === "partielle" ? lireEleves($("#eleves").value) : [], nbEleves: num(g("nbEleves")), nbDP: (dedans ? !$("#paniersEvt").checked : $("#sansRepas").checked) ? 0 : num(g("nbDP")), sansRepas: dedans ? !$("#paniersEvt").checked : $("#sansRepas").checked, besoins: $("#besoins").checked, accompagnateurs: acc,
    transports: dedans ? [] : $$('input[name="transports"]:checked', f).map(i => i.value).concat($("#tr-autre").checked ? [g("trAutre") || "Autre"] : []), hebergement: type === "voyage" ? g("hebergement") : "",
    depenses: dep, coutAccomp: dedans ? 0 : num(g("coutAccomp")), participation: num(g("participation")), pieces: [...state.formPieces],
    intervenant: dedans ? g("intervenant") : "", reglement: g("reglement"), observations: g("observations"),
    technique: dedans ? Object.assign(Object.fromEntries(BESOINS_TECH.map(([k]) => [k, $("#tech-" + k).checked])), { precisions: g("techPrecisions") }) : {},
    status: "brouillon" };
}
function validateForm(x) {
  const e = {};
  if (!x.unite) e.unite = "Choisissez l’unité concernée : elle détermine qui décide.";
  if (!x.titre) e.titre = "Donnez un intitulé au projet.";
  if (!x.lieu) e.lieu = "Indiquez le lieu.";
  if (!x.objectifs) e.objectifs = "Précisez les objectifs pédagogiques : c’est le premier critère de décision.";
  if (!x.dateDebut) e.dateDebut = "Indiquez la date.";
  else if (daysUntil(x.dateDebut) < 0) e.dateDebut = "Cette date est déjà passée.";
  const dedans = x.type === "etablissement", plusieursJours = x.type === "voyage" && x.dateFin && x.dateFin > x.dateDebut;
  if (!x.heureDepart) e.heureDepart = dedans ? "Indiquez l’heure de début." : "Indiquez l’heure de départ.";
  if (!x.heureRetour) e.heureRetour = dedans ? "Indiquez l’heure de fin." : "Indiquez l’heure de retour.";
  else if (x.heureDepart && !plusieursJours && x.heureRetour <= x.heureDepart) e.heureRetour = dedans ? "L’heure de fin doit suivre l’heure de début." : "L’heure de retour doit suivre l’heure de départ.";
  if (x.type === "voyage") { if (!x.dateFin) e.dateFin = "Indiquez la date de retour."; else if (x.dateDebut && x.dateFin < x.dateDebut) e.dateFin = "La date de retour précède la date de départ."; }
  if (x.type !== "etablissement" && x.destination === "etranger" && !x.pays) e.pays = "Indiquez le pays.";
  if (!x.classes) e.classes = "Indiquez la ou les classes.";
  if (!(x.nbEleves > 0)) e.nbEleves = "Indiquez le nombre d’élèves.";
  if (x.classeEntiere === false) {
    const dbl = doublons(x.eleves || []);
    if (!(x.eleves || []).length) e.eleves = "Collez la liste des élèves participants, un par ligne.";
    else if (dbl.length) e.eleves = "Élève(s) en double dans la liste : " + dbl.join(", ") + ".";
    else if (x.nbEleves > 0 && x.eleves.length !== x.nbEleves) e.eleves = "La liste contient " + plural(x.eleves.length, "élève") + " alors que vous en avez indiqué " + x.nbEleves + " : corrigez la liste ou le nombre d’élèves.";
  }
  if (!x.sansRepas && !(x.nbDP > 0)) e.nbDP = x.type === "etablissement" ? "Indiquez le nombre de paniers repas, ou décochez « Des paniers repas sont à prévoir »." : "Indiquez le nombre de demi-pensionnaires, ou cochez « Aucun repas à prévoir ».";
  else if (x.nbDP > x.nbEleves) e.nbDP = "Le nombre de demi-pensionnaires dépasse le nombre d’élèves.";
  if (!x.accompagnateurs.length) e.acc = x.type === "etablissement" ? "Indiquez au moins un adulte chargé de l’encadrement." : "Indiquez au moins un accompagnateur.";
  if (x.type !== "etablissement" && !x.transports.length) e.transports = "Choisissez au moins un mode de transport.";
  else if (x.type !== "etablissement" && x.transports.includes("Autre")) e.trAutre = "Précisez l’autre mode de transport.";
  vigilance(x).filter(v => v[0] === "bad").forEach(v => { e.participation = v[2]; });
  return e;
}
function clearErrors() { $$("#req-form .err").forEach(el => el.textContent = ""); $$("#req-form .invalid").forEach(el => el.classList.remove("invalid")); const fe = $("#form-errors"); if (fe) { fe.classList.add("hidden"); fe.textContent = ""; } }
function showErrors(e, intro) {
  clearErrors();
  const keys = Object.keys(e);
  if (!keys.length) return false;
  let first = null;
  keys.forEach(k => {
    const er = $("#err-" + k); if (er) er.textContent = e[k];
    const ctl = k === "acc" ? $(".acc-row input") : k === "unite" ? $('input[name="unite"]') : $("#" + k);
    if (ctl) { ctl.classList.add("invalid"); first = first || ctl; } else if (er) first = first || er;
  });
  const fe = $("#form-errors");
  fe.textContent = intro || (keys.length === 1 ? "Un point est à corriger avant de soumettre la demande." : keys.length + " points sont à corriger avant de soumettre la demande.");
  fe.classList.remove("hidden");
  if (first) { first.scrollIntoView({ block: "center" }); if (first.focus) first.focus({ preventScroll: true }); }
  return true;
}
function syncForm() {
  const f = $("#req-form"); if (!f) return;
  const type = radioVal(f, "type") || "sortie", dedans = type === "etablissement", dest = dedans ? "france" : radioVal(f, "destination");
  const montre = c => c === "voyage" ? type === "voyage" : c === "etranger" ? dest === "etranger" : c === "dehors" ? !dedans : c === "etablissement" ? dedans
    : c === "repas" ? (dedans ? $("#paniersEvt").checked : !$("#sansRepas").checked) : c === "tr-autre" ? $("#tr-autre").checked : c === "partielle" ? radioVal(f, "participation") === "partielle" : c.startsWith("dep-") ? depVisible(c.slice(4), type) : true;
  $$("[data-if]", f).forEach(el => { const c = el.dataset.if; if (c) el.classList.toggle("hidden", !montre(c)); });
  $("#leg-acc").textContent = dedans ? "5. Encadrement" : "5. Accompagnateurs";
  const ce = $("#eleves-compte");
  if (ce) {
    const n = lireEleves($("#eleves").value).length, annonce = num($("#nbEleves").value);
    ce.textContent = !n ? "" : plural(n, "élève") + " dans la liste" + (annonce > 0 && annonce !== n ? " – vous avez indiqué " + annonce + " élèves." : annonce === n ? " – conforme au nombre d’élèves indiqué." : ".");
    ce.classList.toggle("warn-txt", annonce > 0 && n > 0 && annonce !== n);
  }
  const lab = (id, t) => { const l = f.querySelector('label[for="' + id + '"]'); if (!l) return; const star = l.querySelector(".req-star"); l.textContent = t; if (star) l.append(" ", star); };
  lab("dateDebut", dedans ? "Date" : "Date (ou date de départ)");
  lab("heureDepart", dedans ? "Heure de début" : "Heure de départ");
  lab("heureRetour", dedans ? "Heure de fin" : "Heure de retour");
  lab("nbDP", dedans ? "Nombre de paniers repas" : "Dont demi-pensionnaires");
  $("#titre").placeholder = dedans ? "Ex. : Spectacle de théâtre en anglais" : "Ex. : Visite de l’exposition sur le corps humain";
  $("#lieu").placeholder = dedans ? "Ex. : salle polyvalente" : "Ex. : Cité des sciences et de l’industrie, Paris 19e";
  const x = readForm(), t = totals(x), dir = x.unite ? dirOf(x) : null;
  state.formDraft = x;
  $("#unit-dir").textContent = x.unite ? (dir ? "Décision : " + dir.nom + " (" + (dir.titre || "").toLowerCase() + "). " + chefName() + " est informé et peut arbitrer." : "Aucun directeur n’est enregistré pour cette unité : prévenez l’administrateur de l’outil.") : "L’unité du projet détermine qui décide : " + dirName("college") + " pour le collège, " + dirName("lycee") + " pour le lycée et le pôle supérieur.";
  if (x.unite) { const eu = $("#err-unite"); if (eu) eu.textContent = ""; $$('input[name="unite"]').forEach(i => i.classList.remove("invalid")); }
  $("#live-total").textContent = eur(t.total);
  $("#live-per").textContent = t.n ? eur(t.parEleve) : "–";
  $("#ratio").textContent = x.accompagnateurs.length && t.n ? "Encadrement : " + encadrement(x.accompagnateurs.length, t.n) + "." : "";
  $("#live-vig").innerHTML = renderVig(vigilance(x));
  $("#submit-hint").textContent = dir ? "La demande sera transmise à " + dir.nom + " ; " + chefName() + " en sera informé." : "Choisissez l’unité pour savoir à qui la demande sera transmise.";
  $("#devis-list").innerHTML = state.formPieces.map((p, i) => "<li><span>" + esc(p.nom) + '</span><button type="button" class="btn small ghost" data-action="del-piece" data-i="' + i + '">Retirer</button></li>').join("") +
    state.formFiles.map((f2, i) => "<li><span>" + esc(f2.name) + ' <span class="hint">(à enregistrer)</span></span><button type="button" class="btn small ghost" data-action="del-file" data-i="' + i + '">Retirer</button></li>').join("");
}
async function saveRequest(mode) {
  if (state.busy) return;
  const x = readForm(), m = me();
  if (mode === "submit") { if (showErrors(validateForm(x))) return; }
  else if (!x.titre) { showErrors({ titre: "Donnez au moins un intitulé pour enregistrer le brouillon." }, "Donnez au moins un intitulé pour enregistrer le brouillon."); return; }
  const editing = state.view.name === "edit" && state.current ? state.current : null;
  const files = state.formFiles.slice(), removed = state.formRemoved.slice();
  const boutons = $$(".form-actions .btn"), libelles = boutons.map(b => b.textContent);
  state.busy = true; boutons.forEach(b => { b.disabled = true; }); const label = $('[data-action="' + (mode === "submit" ? "submit-req" : "save-draft") + '"]'); if (label) label.textContent = mode === "submit" ? "Envoi…" : "Enregistrement…";
  let id = editing ? editing.id : null;
  try {
    const payload = toDb(x);
    if (!id) {
      const res = await db.from("demandes").insert(Object.assign(payload, { auteur_email: m.email, auteur_nom: m.name, statut: "brouillon" })).select().single();
      if (res.error) throw res.error;
      id = res.data.id;
    } else {
      const res = await db.from("demandes").update(payload).eq("id", id).select().single();
      if (res.error) throw res.error;
    }
    const lp = await db.from("participants").upsert({ demande_id: id, eleves: x.classeEntiere ? [] : x.eleves }, { onConflict: "demande_id" });
    if (lp.error) throw new Error("La liste des élèves n’a pas pu être enregistrée : " + lp.error.message);
    const pieces = state.formPieces.slice();
    for (const f of files) {
      const chemin = id + "/" + Date.now() + "-" + safeFileName(f.name);
      const up = await db.storage.from(BUCKET).upload(chemin, f, { upsert: false, contentType: f.type || undefined });
      if (up.error) throw new Error("Le fichier « " + f.name + " » n’a pas pu être enregistré : " + up.error.message);
      pieces.push({ nom: f.name, chemin });
    }
    if (removed.length) await db.storage.from(BUCKET).remove(removed);
    if (files.length || removed.length) {
      const res = await db.from("demandes").update({ pieces }).eq("id", id).select().single();
      if (res.error) throw res.error;
    }
    state.formFiles = []; state.formRemoved = []; state.formPieces = pieces;
    if (mode === "submit") {
      const res = await callWorkflow({ action: "soumettre", id });
      state.flashErr = false;
      const dir = dirOf(x);
      state.flash = "Demande transmise à " + (dir ? dir.nom : "la direction") + "." + bilanCourriels(res);
    } else { state.flashErr = false; state.flash = "Brouillon enregistré."; }
    state.busy = false; state.formReady = null;
    await go("detail", id, { keepFlash: true });
  } catch (e) {
    state.busy = false;
    if (id && !editing) {
      // Le brouillon a été créé mais la suite a échoué : on passe en modification de ce brouillon.
      state.view = { name: "edit", id }; setHash(state.view);
      try { await loadDetail(id); } catch (_) { /* on garde l'écran actuel */ }
      state.formReady = "edit-" + id;
      state.formPieces = state.current ? state.current.pieces.slice() : [];
      state.formFiles = files.filter(f => !state.formPieces.some(p => p.nom === f.name));
      state.formRemoved = [];
      render();
    } else {
      boutons.forEach((b, i) => { b.disabled = false; b.textContent = libelles[i]; });
      syncForm();
    }
    const fe = $("#form-errors"); if (fe) { fe.textContent = errText(e); fe.classList.remove("hidden"); fe.scrollIntoView({ block: "center" }); }
  }
}

/* ---------- Décisions et suivi ---------- */
function updateFinSum() {
  const el = $("#fin-sum"); if (!el) return;
  const cost = num(el.dataset.cost);
  const sum = $$("[data-fin]").reduce((s, i) => s + num(i.value), 0);
  const okSum = Math.abs(sum - cost) < 0.01;
  el.innerHTML = "Total financé : <strong>" + eur(sum) + "</strong> par élève pour un coût de " + eur(cost) + (okSum ? " : le budget est équilibré." : " : écart de " + eur(Math.abs(sum - cost)) + ".");
  el.style.color = okSum ? "var(--ok)" : "var(--warn)";
}
function readFin() { const f = {}; $$("[data-fin]").forEach(i => { if (num(i.value) > 0) f[i.dataset.fin] = num(i.value); }); return f; }
async function act(body, okMsg, errField) {
  if (state.busy) return;
  state.busy = true; $$(".actions .btn, .detail-grid button.btn").forEach(b => { b.disabled = true; });
  try {
    const res = await callWorkflow(body);
    state.busy = false; state.flashErr = false;
    state.flash = okMsg + bilanCourriels(res);
    await go("detail", body.id, { keepFlash: true });
  } catch (e) {
    state.busy = false;
    $$(".actions .btn, .detail-grid button.btn").forEach(b => { b.disabled = false; });
    const er = errField && $(errField);
    if (er) er.textContent = errText(e); else { state.flash = errText(e); state.flashErr = true; render(); }
  }
}
function decide(id, decision) {
  const r = state.current, comment = $("#dec-comment").value.trim();
  if (decision !== "validee" && !comment) { $("#dec-err").textContent = decision === "refusee" ? "Indiquez le motif du refus." : "Précisez les compléments attendus."; $("#dec-comment").classList.add("invalid"); $("#dec-comment").focus(); return; }
  act({ action: "decider", id, decision, commentaire: comment, financement: decision === "validee" ? readFin() : null },
    { validee: "Demande validée.", complements: "Demande de compléments envoyée à " + r.author.name + ".", refusee: "Refus notifié à " + r.author.name + "." }[decision], "#dec-err");
}
function arbitrate(id) {
  const decision = $("#arb-decision").value, comment = $("#arb-comment").value.trim();
  if (!comment) { $("#arb-err").textContent = (decision === "complements" ? "Précisez les compléments attendus" : "Indiquez le motif de votre arbitrage") + " : il est transmis à l’organisateur et au directeur de l’unité."; $("#arb-comment").classList.add("invalid"); $("#arb-comment").focus(); return; }
  const r = state.current;
  act({ action: "arbitrer", id, decision, commentaire: comment },
    decision === "complements" ? "Demande renvoyée à " + (r ? r.author.name : "l’organisateur") + " pour compléments." : "Arbitrage enregistré.", "#arb-err");
}
function avis(id) {
  const comment = $("#avis-comment").value.trim();
  if (!comment) { $("#avis-err").textContent = "Rédigez votre avis avant de l’envoyer."; $("#avis-comment").classList.add("invalid"); $("#avis-comment").focus(); return; }
  act({ action: "avis", id, commentaire: comment }, "Avis transmis.", "#avis-err");
}
async function toggleTask(id, fait) {
  if (state.busy) return;
  state.busy = true; render();
  try {
    await callWorkflow({ action: "tache", id, fait });
    state.busy = false;
    state.flash = fait ? "Tâche marquée comme faite." : "Tâche rouverte."; state.flashErr = false;
    await go(state.view.name, state.view.id, { keepFlash: true, keepScroll: true });
  } catch (e) { state.busy = false; state.flash = errText(e); state.flashErr = true; render(); }
}
async function toggleCheck(input) {
  const list = input.dataset.list, cle = input.dataset.item, fait = input.checked, id = Number(input.dataset.id);
  const li = input.closest("li"), card = input.closest(".card");
  li.classList.toggle("done", fait);
  const refresh = () => { const boxes = $$('input[type="checkbox"]', card), cnt = card.querySelector("[data-count]"); if (cnt) cnt.textContent = boxes.filter(b => b.checked).length + " sur " + boxes.length; };
  refresh();
  try {
    await callWorkflow({ action: list, id, cle, fait });
    if (state.current) state.current[list === "etape" ? "checklist" : "checkDir"][cle] = fait;
  } catch (e) {
    input.checked = !fait; li.classList.toggle("done", !fait); refresh();
    state.flash = errText(e); state.flashErr = true;
    const flash = $(".flash"); if (flash) { flash.textContent = state.flash; flash.className = "flash err-flash"; } else { const nav = $("nav.tabs"); if (nav) nav.insertAdjacentHTML("afterend", '<div class="flash err-flash" role="status">' + esc(state.flash) + "</div>"); }
  }
}
async function deleteDraft(btn) {
  const id = Number(btn.dataset.id);
  if (btn.dataset.armed !== "1") { btn.dataset.armed = "1"; btn.textContent = "Confirmer la suppression"; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ""; btn.textContent = "Supprimer le brouillon"; } }, 5000); return; }
  state.busy = true; btn.disabled = true;
  try {
    const paths = (state.current && state.current.pieces || []).map(p => p.chemin);
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
    const res = await db.from("demandes").delete().eq("id", id);
    if (res.error) throw res.error;
    state.busy = false; state.flash = "Brouillon supprimé."; state.flashErr = false;
    await go("mine", null, { keepFlash: true });
  } catch (e) { state.busy = false; state.flash = errText(e); state.flashErr = true; render(); }
}

/* ---------- Événements ---------- */
document.addEventListener("click", e => {
  const menu = $("#menu");
  if (menu && menu.open && !e.target.closest("#menu")) menu.open = false;
  const a = e.target.closest("[data-action]"); if (!a) return;
  const act2 = a.dataset.action, id = a.dataset.id ? Number(a.dataset.id) : null;
  if (a.tagName === "BUTTON") e.preventDefault();
  switch (act2) {
    case "logout": db.auth.signOut().finally(() => { state.session = null; state.me = null; state.mustChange = false; state.requests = []; state.current = null; state.comptes = []; state.comptesRes = null; state.flash = ""; state.login = { step: "password", email: "", error: "", info: "" }; setHash({ name: "home" }); render(); window.scrollTo(0, 0); }); break;
    case "forgot": { const f = $("#login-email"); state.login = { step: "reset", email: f ? f.value.trim().toLowerCase() : state.login.email, error: "", info: "" }; render(); const r = $("#reset-email"); if (r) r.focus(); break; }
    case "login-back": state.login = { step: "password", email: state.login.email, error: "", info: "" }; render(); break;
    case "resend": sendResetCode(state.login.email); break;
    case "creer-comptes": {
      const t = $("#comptes-emails").value.trim();
      if (!t) { $("#comptes-err").textContent = "Collez au moins une adresse."; break; }
      actionComptes({ action: "creer_comptes", emails: t }, res => { const n = (res.resultats || []).filter(r => r.statut === "cree").length; return n ? plural(n, "compte créé", "comptes créés") + "." : "Aucun nouveau compte créé."; });
      break;
    }
    case "copier-mdp":
    case "copier-message": {
      const r = (state.comptesRes || [])[+a.dataset.i]; if (!r || !r.mdp) break;
      const adresse = location.href.replace(/[?#].*$/, "");
      const texte = a.dataset.action === "copier-mdp" ? r.mdp
        : "Bonjour,\nVoici votre accès à Cap Projets, l’outil des sorties, voyages et événements du Protectorat Saint-Joseph.\nAdresse : " + adresse + "\nIdentifiant : " + r.email + "\nMot de passe provisoire : " + r.mdp + "\nÀ la première connexion, l’outil vous demandera de choisir votre propre mot de passe.";
      const label = a.textContent;
      const fini = t => { a.textContent = t; setTimeout(() => { if (a.isConnected) a.textContent = label; }, 2000); };
      try { navigator.clipboard.writeText(texte).then(() => fini("Copié"), () => fini("Copie impossible")); } catch (err) { fini("Copie impossible"); }
      break;
    }
    case "copier-eleves": {
      const l = state.current && state.current.eleves || []; if (!l.length) break;
      const label = a.textContent;
      const fini = t => { a.textContent = t; setTimeout(() => { if (a.isConnected) a.textContent = label; }, 2000); };
      try { navigator.clipboard.writeText(l.join("\n")).then(() => fini("Liste copiée"), () => fini("Copie impossible")); } catch (err) { fini("Copie impossible"); }
      break;
    }
    case "compte-reinit": actionComptes({ action: "reinitialiser_compte", email: a.dataset.email }, () => "Nouveau mot de passe provisoire créé pour " + a.dataset.email + "."); break;
    case "compte-reactiver": actionComptes({ action: "reactiver_compte", email: a.dataset.email }, () => "Compte réactivé : " + a.dataset.email + "."); break;
    case "compte-desactiver": {
      if (a.dataset.armed !== "1") { a.dataset.armed = "1"; a.textContent = "Confirmer"; setTimeout(() => { if (a.isConnected) { a.dataset.armed = ""; a.textContent = "Désactiver"; } }, 5000); break; }
      actionComptes({ action: "desactiver_compte", email: a.dataset.email }, () => "Compte désactivé : " + a.dataset.email + ".");
      break;
    }
    case "tab": if (a.dataset.view === "all") state.filter = "tous"; state.formReady = null; go(a.dataset.view); break;
    case "filter": state.filter = a.dataset.f; render(); break;
    case "open": go("detail", id); break;
    case "edit": state.formReady = null; go("edit", id); break;
    case "scroll": { const t = document.getElementById(a.dataset.target); if (t) t.scrollIntoView({ block: "start" }); break; }
    case "add-acc": { const list = $("#acc-list"); list.insertAdjacentHTML("beforeend", accRow()); list.lastElementChild.querySelector("input").focus(); syncForm(); break; }
    case "del-acc": { if ($$(".acc-row").length > 1) a.closest(".acc-row").remove(); else a.closest(".acc-row").querySelector('[data-k="nom"]').value = ""; syncForm(); break; }
    case "del-piece": { const p = state.formPieces.splice(+a.dataset.i, 1)[0]; if (p) state.formRemoved.push(p.chemin); syncForm(); break; }
    case "del-file": state.formFiles.splice(+a.dataset.i, 1); syncForm(); break;
    case "save-draft": saveRequest("draft"); break;
    case "submit-req": saveRequest("submit"); break;
    case "decide": decide(id, a.dataset.decision); break;
    case "arbitrate": arbitrate(id); break;
    case "avis": avis(id); break;
    case "task": toggleTask(id, a.dataset.fait === "1"); break;
    case "check": toggleCheck(a); break;
    case "delete-draft": deleteDraft(a); break;
    case "copy-auth": {
      const r = id && state.current && state.current.id === id ? state.current : null;
      try { navigator.clipboard.writeText(autorisationText(r)).then(() => { a.textContent = "Texte copié"; }, () => { a.textContent = "Copie impossible ici"; }); } catch (err) { a.textContent = "Copie impossible ici"; }
      break;
    }
  }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset && t.dataset.voirMdp) { t.dataset.voirMdp.split(",").forEach(id => { const i = $("#" + id); if (i) i.type = t.checked ? "text" : "password"; }); return; }
  if (t.id === "devis-input") {
    const er = $("#err-devis"); if (er) er.textContent = "";
    const trop = [...t.files].filter(f => f.size > TAILLE_MAX);
    [...t.files].filter(f => f.size <= TAILLE_MAX).forEach(f => state.formFiles.push(f));
    if (trop.length && er) er.textContent = "Fichier trop lourd (10 Mo au plus) : " + trop.map(f => f.name).join(", ") + ".";
    t.value = ""; syncForm(); return;
  }
  if (t.closest && t.closest("#req-form")) syncForm();
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.closest && t.closest("#req-form")) {
    t.classList.remove("invalid");
    const er = t.id ? $("#err-" + t.id) : null; if (er) er.textContent = "";
    if (t.closest(".acc-row")) { const ea = $("#err-acc"); if (ea) ea.textContent = ""; }
    syncForm();
  }
  if (t.dataset && t.dataset.fin) updateFinSum();
  if (t.id === "comptes-filtre") { const q = t.value.trim().toLowerCase(); $$("tr[data-email]").forEach(tr => tr.classList.toggle("hidden", !!q && !tr.dataset.email.includes(q))); }
  if (t.id === "comptes-emails") { const er = $("#comptes-err"); if (er) er.textContent = ""; }
  if (["dec-comment", "arb-comment", "avis-comment"].includes(t.id)) { t.classList.remove("invalid"); const er = $("#" + t.id.split("-")[0] + "-err"); if (er) er.textContent = ""; }
});
document.addEventListener("submit", e => {
  e.preventDefault();
  if (state.busy) return;
  const id = e.target.id;
  const domaineOk = email => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Saisissez votre adresse complète, sous la forme prenom.nom@" + DOMAIN + ".";
    if (!email.endsWith("@" + DOMAIN)) return "Seules les adresses de l’établissement (prenom.nom@" + DOMAIN + ") donnent accès à l’outil.";
    return "";
  };
  if (id === "login-form") {
    const email = $("#login-email").value.trim().toLowerCase(), pwd = $("#login-password").value;
    const pb = domaineOk(email) || (pwd ? "" : "Saisissez votre mot de passe.");
    if (pb) { state.login = { step: "password", email, error: pb, info: "" }; render(); return; }
    signIn(email, pwd);
  }
  if (id === "reset-form") {
    const email = $("#reset-email").value.trim().toLowerCase(), pb = domaineOk(email);
    if (pb) { state.login = { step: "reset", email, error: pb, info: "" }; render(); return; }
    sendResetCode(email);
  }
  if (id === "reset-code-form") {
    const token = $("#reset-code").value.replace(/\D/g, ""), p1 = $("#reset-mdp1").value, p2 = $("#reset-mdp2").value;
    const pb = token.length < 6 ? "Saisissez le code reçu par courriel." : pwdProbleme(p1, p2);
    if (pb) { $("#login-err").textContent = pb; return; }
    resetWithCode(token, p1);
  }
  if (id === "mdp-form") changePassword($("#mdp-1").value, $("#mdp-2").value);
});
window.addEventListener("hashchange", () => {
  const m = /^#demande-(\d+)$/.exec(location.hash);
  if (m && me() && !(state.view.name === "detail" && state.view.id === Number(m[1]))) go("detail", Number(m[1]));
});

/* ---------- Démarrage ---------- */
function renderConfigMissing(msg) {
  $("#app").innerHTML = '<div class="card config-err stack"><h1>Réglage à terminer</h1><p>' + esc(msg || "Le fichier config.js n’est pas encore rempli : indiquez l’adresse du projet Supabase et sa clé publique.") + '</p><p class="hint">Voir l’étape 4 du guide de mise en ligne.</p></div>';
}
async function start() {
  const C = window.CONFIG || {};
  if (!C.supabaseUrl || /VOTRE/.test(C.supabaseUrl) || !C.supabaseKey || /VOTRE/.test(C.supabaseKey)) { renderConfigMissing(); return; }
  if (/^sb_secret_/.test(C.supabaseKey)) { renderConfigMissing("La clé indiquée dans config.js est la clé SECRÈTE. Remplacez-la tout de suite par la clé publique (publishable), puis régénérez la clé secrète dans Supabase."); return; }
  if (!window.supabase || !window.supabase.createClient) { renderConfigMissing("La bibliothèque Supabase n’a pas pu être chargée. Vérifiez votre connexion internet et rechargez la page."); return; }
  db = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const m = /^#demande-(\d+)$/.exec(location.hash);
  if (m) { try { localStorage.setItem("sv-cible", m[1]); } catch (_) { } }
  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") { state.session = null; state.me = null; render(); }
    else if (event === "SIGNED_IN" && session && !state.session && !state.authFlow) setTimeout(() => { if (!state.session && !state.authFlow) onSession(session); }, 0);
  });
  const { data } = await db.auth.getSession();
  if (data && data.session) await onSession(data.session); else render();
}
start();
