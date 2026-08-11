import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { PrismaClient, ProjectType } from "../generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
	console.log("🌱 Seeding database...");

	// ============================================================
	// CATEGORIES
	// ============================================================

	// Les identifiants sont explicites et NE DOIVENT PAS changer.
	// auth.service.ts référence en dur les catégories 3, 4 et 6 pour construire
	// le projet de démonstration créé à l'inscription :
	//   3 = Restaurants   4 = Hébergement   6 = Courses
	// Sans identifiants explicites, les upsert lancés en parallèle reçoivent
	// leur id dans l'ordre où ils atteignent la base — donc de façon non
	// déterministe. C'est ce qui a provoqué l'erreur P2003 en production.
	const [divers, restaurants, hebergement, transport, courses, loisir] =
		await Promise.all([
			prisma.category.upsert({
				where: { color: "#A9A9A9" },
				update: {},
				create: { id: 1, name: "Divers", color: "#A9A9A9" },
			}),
			prisma.category.upsert({
				where: { color: "#228B22" },
				update: {},
				create: { id: 3, name: "Restaurants", color: "#228B22" },
			}),
			prisma.category.upsert({
				where: { color: "#1E90FF" },
				update: {},
				create: { id: 4, name: "Hébergement", color: "#1E90FF" },
			}),
			prisma.category.upsert({
				where: { color: "#FF8C00" },
				update: {},
				create: { id: 2, name: "Transport", color: "#FF8C00" },
			}),
			prisma.category.upsert({
				where: { color: "#6B8E23" },
				update: {},
				create: { id: 6, name: "Courses", color: "#6B8E23" },
			}),
			prisma.category.upsert({
				where: { color: "#9370DB" },
				update: {},
				create: { id: 5, name: "Loisir", color: "#9370DB" },
			}),
		]);

	// Note : la colonne id est un SERIAL et la séquence n'est pas avancée par ces
	// insertions explicites. Sans conséquence ici — aucune catégorie n'est créée à
	// l'exécution, l'API n'expose pas d'endpoint de création.

	console.log("✅ 6 categories seeded");

	// ============================================================
	// USERS
	// steve@lapince.fr / password123  → compte principal démo
	// aurore@lapince.fr / password123 → compte secondaire (test 403)
	// ============================================================

	const passwordHash = await argon2.hash("password123");

	const steve = await prisma.appUser.upsert({
		where: { email: "steve@lapince.fr" },
		update: {},
		create: {
			name: "Steve",
			email: "steve@lapince.fr",
			password: passwordHash,
		},
	});

	const aurore = await prisma.appUser.upsert({
		where: { email: "aurore@lapince.fr" },
		update: {},
		create: {
			name: "Aurore",
			email: "aurore@lapince.fr",
			password: passwordHash,
		},
	});

	console.log("✅ 2 users seeded");
	console.log("   → steve@lapince.fr  / password123");
	console.log("   → aurore@lapince.fr / password123");

	// ============================================================
	// PARTICIPANTS
	// pSteve lié au compte steve → KPI dashboard actifs
	// pAurore lié au compte aurore → KPI dashboard actifs pour Aurore
	// Tous les autres → invités sans compte
	// ============================================================

	const pSteve = await prisma.participant.upsert({
		where: { id: 1 },
		update: {},
		create: { name: "Steve", appUserId: steve.id },
	});
	const pAurore = await prisma.participant.upsert({
		where: { id: 2 },
		update: {},
		create: { name: "Aurore", appUserId: aurore.id },
	});
	const pLudo = await prisma.participant.upsert({
		where: { id: 3 },
		update: {},
		create: { name: "Ludo", appUserId: null },
	});
	const pJerem = await prisma.participant.upsert({
		where: { id: 4 },
		update: {},
		create: { name: "Jérémy", appUserId: null },
	});
	const pSophie = await prisma.participant.upsert({
		where: { id: 5 },
		update: {},
		create: { name: "Sophie", appUserId: null },
	});
	const pMarco = await prisma.participant.upsert({
		where: { id: 6 },
		update: {},
		create: { name: "Marco", appUserId: null },
	});
	const pLea = await prisma.participant.upsert({
		where: { id: 7 },
		update: {},
		create: { name: "Léa", appUserId: null },
	});
	const pThomas = await prisma.participant.upsert({
		where: { id: 8 },
		update: {},
		create: { name: "Thomas", appUserId: null },
	});
	const pNina = await prisma.participant.upsert({
		where: { id: 9 },
		update: {},
		create: { name: "Nina", appUserId: null },
	});
	const pPaul = await prisma.participant.upsert({
		where: { id: 10 },
		update: {},
		create: { name: "Paul", appUserId: null },
	});

	console.log("✅ 10 participants seeded");

	// ============================================================
	// HELPER — upsert opération + répartitions
	// ============================================================

	async function seedOperation(op: {
		id: number;
		name: string;
		amount: number;
		isAmountCalculated: boolean;
		date: string;
		payerId: number;
		categoryId: number;
		projectId: number;
		ownerId: number;
		split: { participantId: number; amount: number; isCalculated: boolean }[];
	}) {
		const created = await prisma.operation.upsert({
			where: { id: op.id },
			update: {},
			create: {
				name: op.name,
				amount: op.amount,
				isAmountCalculated: op.isAmountCalculated,
				date: new Date(op.date),
				payerParticipantId: op.payerId,
				appUserId: op.ownerId,
				categoryId: op.categoryId,
				projectId: op.projectId,
			},
		});
		for (const s of op.split) {
			await prisma.operationParticipant.upsert({
				where: {
					operationId_participantId: {
						operationId: created.id,
						participantId: s.participantId,
					},
				},
				update: {},
				create: {
					operationId: created.id,
					participantId: s.participantId,
					repartitionAmount: s.amount,
					isRepartitionAmountCalculated: s.isCalculated,
				},
			});
		}
	}

	// ============================================================
	// HELPER — upsert alerte + liaison AppUserAlert
	// ============================================================

	async function seedAlert(alert: {
		id: number;
		status: string;
		threshold: number;
		totalSpent: number;
		budgetAmount: number;
		budgetId: number;
		userId: number;
	}) {
		const baseMessage = `Le budget du projet a dépassé ${alert.threshold} % du montant prévu — ${alert.totalSpent.toFixed(2)} € sur ${alert.budgetAmount.toFixed(2)} €.`;
		const message =
			alert.status === "resolved"
				? `${baseMessage} Seuil dépassé puis résolu.`
				: baseMessage;

		await prisma.alert.upsert({
			where: { id: alert.id },
			update: {},
			create: {
				id: alert.id,
				status: alert.status,
				message,
				budgetId: alert.budgetId,
			},
		});
		await prisma.appUserAlert.upsert({
			where: {
				appUserId_alertId: { appUserId: alert.userId, alertId: alert.id },
			},
			update: {},
			create: { appUserId: alert.userId, alertId: alert.id },
		});
	}

	// ╔══════════════════════════════════════════════════════════╗
	// ║              PROJETS DE STEVE                           ║
	// ╚══════════════════════════════════════════════════════════╝

	// ============================================================
	// PROJECT 1 — Voyage Milan (Steve)
	// Type : Voyage ✅
	// Budget : 600 € / seuil 80 % → 594 € → alerte UNREAD
	// Participants : Steve, Aurore, Ludo (3)
	// Greedy → 2 transactions
	// ~15 opérations → test pagination
	// Payeur absent de sa répartition (Aurore, op restaurant)
	// KPI : Steve à recevoir (paie hôtel + train)
	// ============================================================

	const projectMilan = await prisma.project.upsert({
		where: { id: 1 },
		update: {},
		create: {
			name: "Voyage Milan",
			description: "Week-end entre amis à Milan — mai 2026",
			type: ProjectType.Voyage,
			appUserId: steve.id,
		},
	});

	for (const pid of [pSteve.id, pAurore.id, pLudo.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectMilan.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectMilan.id, participantId: pid },
		});
	}

	const budgetMilan = await prisma.budget.upsert({
		where: { projectId: projectMilan.id },
		update: {},
		create: { amount: 600.0, limitCriteria: 80.0, projectId: projectMilan.id },
	});

	for (const op of [
		{
			id: 1,
			name: "Hôtel — nuit 1",
			amount: 135.0,
			isAmountCalculated: false,
			date: "2026-05-15",
			payerId: pSteve.id,
			categoryId: hebergement.id,
			split: [
				{ participantId: pSteve.id, amount: 45.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 45.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 45.0, isCalculated: true },
			],
		},
		{
			id: 2,
			name: "Hôtel — nuit 2",
			amount: 135.0,
			isAmountCalculated: false,
			date: "2026-05-16",
			payerId: pSteve.id,
			categoryId: hebergement.id,
			split: [
				{ participantId: pSteve.id, amount: 45.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 45.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 45.0, isCalculated: true },
			],
		},
		{
			id: 3,
			name: "Billets de train aller",
			amount: 75.0,
			isAmountCalculated: false,
			date: "2026-05-15",
			payerId: pSteve.id,
			categoryId: transport.id,
			split: [
				{ participantId: pSteve.id, amount: 25.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 25.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 25.0, isCalculated: true },
			],
		},
		{
			id: 4,
			name: "Billets de train retour",
			amount: 75.0,
			isAmountCalculated: false,
			date: "2026-05-17",
			payerId: pSteve.id,
			categoryId: transport.id,
			split: [
				{ participantId: pSteve.id, amount: 25.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 25.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 25.0, isCalculated: true },
			],
		},
		{
			id: 5,
			name: "Restaurant Il Duomo",
			amount: 84.0,
			isAmountCalculated: false,
			date: "2026-05-15",
			// Aurore paie mais ne mange pas → payeur absent de sa propre répartition
			payerId: pAurore.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 42.0, isCalculated: false },
				{ participantId: pLudo.id, amount: 42.0, isCalculated: false },
			],
		},
		{
			id: 6,
			name: "Pizzeria Brera",
			amount: 54.0,
			isAmountCalculated: false,
			date: "2026-05-16",
			payerId: pLudo.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 18.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 18.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 18.0, isCalculated: true },
			],
		},
		{
			id: 7,
			name: "Apéro bar Navigli",
			amount: 39.0,
			isAmountCalculated: false,
			date: "2026-05-16",
			payerId: pAurore.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 13.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 13.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 13.0, isCalculated: true },
			],
		},
		{
			id: 8,
			name: "Courses petit-déj",
			amount: 18.0,
			isAmountCalculated: false,
			date: "2026-05-16",
			payerId: pSteve.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 6.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 6.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 6.0, isCalculated: true },
			],
		},
		{
			id: 9,
			name: "Taxi aéroport",
			amount: 27.0,
			isAmountCalculated: false,
			date: "2026-05-15",
			payerId: pLudo.id,
			categoryId: transport.id,
			split: [
				{ participantId: pSteve.id, amount: 9.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 9.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 9.0, isCalculated: true },
			],
		},
		{
			id: 10,
			name: "Musée Pinacothèque",
			amount: 36.0,
			isAmountCalculated: false,
			date: "2026-05-16",
			payerId: pSteve.id,
			categoryId: loisir.id,
			split: [
				{ participantId: pSteve.id, amount: 12.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 12.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 12.0, isCalculated: true },
			],
		},
		{
			id: 11,
			name: "Visite Duomo",
			amount: 15.0,
			isAmountCalculated: false,
			date: "2026-05-16",
			payerId: pAurore.id,
			categoryId: loisir.id,
			split: [
				{ participantId: pSteve.id, amount: 5.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 5.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 5.0, isCalculated: true },
			],
		},
		{
			id: 12,
			name: "Souvenirs marché",
			amount: 30.0,
			isAmountCalculated: false,
			date: "2026-05-17",
			payerId: pLudo.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 10.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 10.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 10.0, isCalculated: true },
			],
		},
		{
			id: 13,
			name: "Glaces Grom",
			amount: 12.0,
			isAmountCalculated: false,
			date: "2026-05-17",
			payerId: pSteve.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 4.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 4.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 4.0, isCalculated: true },
			],
		},
		{
			id: 14,
			name: "Bus aéroport retour",
			amount: 18.0,
			isAmountCalculated: false,
			date: "2026-05-17",
			payerId: pAurore.id,
			categoryId: transport.id,
			split: [
				{ participantId: pSteve.id, amount: 6.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 6.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 6.0, isCalculated: true },
			],
		},
		{
			id: 15,
			name: "Dîner dernière nuit",
			amount: 66.0,
			isAmountCalculated: false,
			date: "2026-05-17",
			payerId: pSteve.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 22.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 22.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 22.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectMilan.id,
			ownerId: steve.id,
		});
	}

	await seedAlert({
		id: 1,
		status: "unread",
		threshold: 80,
		totalSpent: 819.0,
		budgetAmount: 600.0,
		budgetId: budgetMilan.id,
		userId: steve.id,
	});

	console.log("✅ project 1 seeded — Voyage Milan (15 ops, alerte unread)");

	// ============================================================
	// PROJECT 2 — Coloc rue Pasteur (Steve)
	// Type : Maison_Coloc ✅
	// Budget : 2000 € / seuil 90 % → alerte READ
	// Participants : Steve, Ludo, Jérémy (3)
	// ~15 opérations → test pagination
	// KPI : Steve à recevoir (paie les loyers)
	// ============================================================

	const projectColoc = await prisma.project.upsert({
		where: { id: 2 },
		update: {},
		create: {
			name: "Coloc rue Pasteur",
			description: "Dépenses partagées de la colocation",
			type: ProjectType.Maison_Coloc,
			appUserId: steve.id,
		},
	});

	for (const pid of [pSteve.id, pLudo.id, pJerem.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectColoc.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectColoc.id, participantId: pid },
		});
	}

	const budgetColoc = await prisma.budget.upsert({
		where: { projectId: projectColoc.id },
		update: {},
		create: { amount: 2000.0, limitCriteria: 90.0, projectId: projectColoc.id },
	});

	for (const op of [
		{
			id: 20,
			name: "Loyer avril",
			amount: 900.0,
			isAmountCalculated: false,
			date: "2026-04-01",
			payerId: pSteve.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 300.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 300.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 300.0, isCalculated: true },
			],
		},
		{
			id: 21,
			name: "Loyer mai",
			amount: 900.0,
			isAmountCalculated: false,
			date: "2026-05-01",
			payerId: pSteve.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 300.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 300.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 300.0, isCalculated: true },
			],
		},
		{
			id: 22,
			name: "Électricité avril",
			amount: 58.0,
			isAmountCalculated: false,
			date: "2026-04-05",
			payerId: pSteve.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 19.34, isCalculated: true },
				{ participantId: pLudo.id, amount: 19.33, isCalculated: true },
				{ participantId: pJerem.id, amount: 19.33, isCalculated: true },
			],
		},
		{
			id: 23,
			name: "Électricité mai",
			amount: 62.0,
			isAmountCalculated: false,
			date: "2026-05-05",
			payerId: pSteve.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 20.67, isCalculated: true },
				{ participantId: pLudo.id, amount: 20.67, isCalculated: true },
				{ participantId: pJerem.id, amount: 20.66, isCalculated: true },
			],
		},
		{
			id: 24,
			name: "Internet + box",
			amount: 39.99,
			isAmountCalculated: false,
			date: "2026-04-05",
			payerId: pJerem.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 13.33, isCalculated: true },
				{ participantId: pLudo.id, amount: 13.33, isCalculated: true },
				{ participantId: pJerem.id, amount: 13.33, isCalculated: true },
			],
		},
		{
			id: 25,
			name: "Internet + box",
			amount: 39.99,
			isAmountCalculated: false,
			date: "2026-05-05",
			payerId: pJerem.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 13.33, isCalculated: true },
				{ participantId: pLudo.id, amount: 13.33, isCalculated: true },
				{ participantId: pJerem.id, amount: 13.33, isCalculated: true },
			],
		},
		{
			id: 26,
			name: "Courses Leclerc",
			amount: 87.4,
			isAmountCalculated: false,
			date: "2026-04-10",
			payerId: pLudo.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 29.14, isCalculated: true },
				{ participantId: pLudo.id, amount: 29.13, isCalculated: true },
				{ participantId: pJerem.id, amount: 29.13, isCalculated: true },
			],
		},
		{
			id: 27,
			name: "Courses Monoprix",
			amount: 64.2,
			isAmountCalculated: false,
			date: "2026-04-20",
			payerId: pSteve.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 21.4, isCalculated: true },
				{ participantId: pLudo.id, amount: 21.4, isCalculated: true },
				{ participantId: pJerem.id, amount: 21.4, isCalculated: true },
			],
		},
		{
			id: 28,
			name: "Courses Leclerc",
			amount: 92.6,
			isAmountCalculated: false,
			date: "2026-05-12",
			payerId: pLudo.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 30.87, isCalculated: true },
				{ participantId: pLudo.id, amount: 30.87, isCalculated: true },
				{ participantId: pJerem.id, amount: 30.86, isCalculated: true },
			],
		},
		{
			id: 29,
			name: "Produits ménagers",
			amount: 28.5,
			isAmountCalculated: false,
			date: "2026-04-15",
			payerId: pJerem.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 9.5, isCalculated: true },
				{ participantId: pLudo.id, amount: 9.5, isCalculated: true },
				{ participantId: pJerem.id, amount: 9.5, isCalculated: true },
			],
		},
		{
			id: 30,
			name: "Produits ménagers",
			amount: 31.0,
			isAmountCalculated: false,
			date: "2026-05-18",
			payerId: pSteve.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 10.34, isCalculated: true },
				{ participantId: pLudo.id, amount: 10.33, isCalculated: true },
				{ participantId: pJerem.id, amount: 10.33, isCalculated: true },
			],
		},
		{
			id: 31,
			name: "Eau chaude (plombier)",
			amount: 120.0,
			isAmountCalculated: false,
			date: "2026-04-22",
			payerId: pSteve.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 40.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 40.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 40.0, isCalculated: true },
			],
		},
		{
			id: 32,
			name: "Abonnement Netflix partagé",
			amount: 17.99,
			isAmountCalculated: false,
			date: "2026-04-01",
			payerId: pLudo.id,
			categoryId: loisir.id,
			split: [
				{ participantId: pSteve.id, amount: 6.0, isCalculated: false },
				{ participantId: pLudo.id, amount: 6.0, isCalculated: false },
				{ participantId: pJerem.id, amount: 5.99, isCalculated: false },
			],
		},
		{
			id: 33,
			name: "Abonnement Netflix partagé",
			amount: 17.99,
			isAmountCalculated: false,
			date: "2026-05-01",
			payerId: pLudo.id,
			categoryId: loisir.id,
			split: [
				{ participantId: pSteve.id, amount: 6.0, isCalculated: false },
				{ participantId: pLudo.id, amount: 6.0, isCalculated: false },
				{ participantId: pJerem.id, amount: 5.99, isCalculated: false },
			],
		},
		{
			id: 34,
			name: "Assurance habitation",
			amount: 42.0,
			isAmountCalculated: false,
			date: "2026-04-01",
			payerId: pJerem.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 14.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 14.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 14.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectColoc.id,
			ownerId: steve.id,
		});
	}

	await seedAlert({
		id: 2,
		status: "read",
		threshold: 90,
		totalSpent: 2503.66,
		budgetAmount: 2000.0,
		budgetId: budgetColoc.id,
		userId: steve.id,
	});

	console.log("✅ project 2 seeded — Coloc rue Pasteur (15 ops, alerte read)");

	// ============================================================
	// PROJECT 3 — Anniversaire Sophie (Steve)
	// Type : Anniversaire ✅
	// Budget : 300 € / seuil 75 % → alerte RESOLVED
	// Participants : Steve, Aurore, Ludo, Jérémy (4)
	// Répartition inégale (parts custom)
	// KPI : Steve doit de l'argent
	// ============================================================

	const projectAnniv = await prisma.project.upsert({
		where: { id: 3 },
		update: {},
		create: {
			name: "Anniversaire Sophie",
			description: "Surprise pour les 30 ans de Sophie",
			type: ProjectType.Anniversaire,
			appUserId: steve.id,
		},
	});

	for (const pid of [pSteve.id, pAurore.id, pLudo.id, pJerem.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectAnniv.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectAnniv.id, participantId: pid },
		});
	}

	const budgetAnniv = await prisma.budget.upsert({
		where: { projectId: projectAnniv.id },
		update: {},
		create: { amount: 300.0, limitCriteria: 75.0, projectId: projectAnniv.id },
	});

	for (const op of [
		{
			id: 40,
			name: "Location salle",
			amount: 120.0,
			isAmountCalculated: false,
			date: "2026-04-15",
			payerId: pAurore.id,
			categoryId: loisir.id,
			// Répartition inégale : organisateurs paient moins
			split: [
				{ participantId: pSteve.id, amount: 40.0, isCalculated: false },
				{ participantId: pAurore.id, amount: 20.0, isCalculated: false },
				{ participantId: pLudo.id, amount: 20.0, isCalculated: false },
				{ participantId: pJerem.id, amount: 40.0, isCalculated: false },
			],
		},
		{
			id: 41,
			name: "Gâteau et buffet",
			amount: 95.0,
			isAmountCalculated: false,
			date: "2026-04-15",
			payerId: pJerem.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 23.75, isCalculated: true },
				{ participantId: pAurore.id, amount: 23.75, isCalculated: true },
				{ participantId: pLudo.id, amount: 23.75, isCalculated: true },
				{ participantId: pJerem.id, amount: 23.75, isCalculated: true },
			],
		},
		{
			id: 42,
			name: "Décorations",
			amount: 38.0,
			isAmountCalculated: false,
			date: "2026-04-14",
			payerId: pLudo.id,
			categoryId: loisir.id,
			split: [
				{ participantId: pSteve.id, amount: 9.5, isCalculated: true },
				{ participantId: pAurore.id, amount: 9.5, isCalculated: true },
				{ participantId: pLudo.id, amount: 9.5, isCalculated: true },
				{ participantId: pJerem.id, amount: 9.5, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectAnniv.id,
			ownerId: steve.id,
		});
	}

	await seedAlert({
		id: 3,
		status: "resolved",
		threshold: 75,
		totalSpent: 253.0,
		budgetAmount: 300.0,
		budgetId: budgetAnniv.id,
		userId: steve.id,
	});

	console.log("✅ project 3 seeded — Anniversaire Sophie (alerte resolved)");

	// ============================================================
	// PROJECT 4 — Soirée raclette (Steve)
	// Type : Repas_Sortie ✅
	// Sans budget
	// Balances équilibrées → 0 remboursements
	// ============================================================

	const projectRaclette = await prisma.project.upsert({
		where: { id: 4 },
		update: {},
		create: {
			name: "Soirée raclette",
			description: "Raclette du vendredi soir chez Steve",
			type: ProjectType.Repas_Sortie,
			appUserId: steve.id,
		},
	});

	for (const pid of [pSteve.id, pJerem.id, pLea.id, pThomas.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectRaclette.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectRaclette.id, participantId: pid },
		});
	}

	for (const op of [
		{
			id: 50,
			name: "Fromages et charcuterie",
			amount: 52.0,
			isAmountCalculated: false,
			date: "2026-05-09",
			payerId: pSteve.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 13.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 13.0, isCalculated: true },
				{ participantId: pLea.id, amount: 13.0, isCalculated: true },
				{ participantId: pThomas.id, amount: 13.0, isCalculated: true },
			],
		},
		{
			id: 51,
			name: "Vins et boissons",
			amount: 28.0,
			isAmountCalculated: false,
			date: "2026-05-09",
			payerId: pJerem.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 7.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 7.0, isCalculated: true },
				{ participantId: pLea.id, amount: 7.0, isCalculated: true },
				{ participantId: pThomas.id, amount: 7.0, isCalculated: true },
			],
		},
		{
			id: 52,
			name: "Pain et accompagnements",
			amount: 20.0,
			isAmountCalculated: false,
			date: "2026-05-09",
			payerId: pLea.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 5.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 5.0, isCalculated: true },
				{ participantId: pLea.id, amount: 5.0, isCalculated: true },
				{ participantId: pThomas.id, amount: 5.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectRaclette.id,
			ownerId: steve.id,
		});
	}

	console.log(
		"✅ project 4 seeded — Soirée raclette (sans budget, balances nulles)",
	);

	// ============================================================
	// PROJECT 5 — Séminaire tech (Steve)
	// Type : Pro_Travail ✅
	// Budget : 3000 € / seuil 80 % → 1557.50 € → non atteint, 0 alerte
	// Participants : Steve, Thomas, Léa, Marco (4)
	// Greedy → 3 transactions
	// ============================================================

	const projectSeminaire = await prisma.project.upsert({
		where: { id: 5 },
		update: {},
		create: {
			name: "Séminaire tech",
			description: "Séminaire annuel de l'équipe tech",
			type: ProjectType.Pro_Travail,
			appUserId: steve.id,
		},
	});

	for (const pid of [pSteve.id, pThomas.id, pLea.id, pMarco.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectSeminaire.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectSeminaire.id, participantId: pid },
		});
	}

	await prisma.budget.upsert({
		where: { projectId: projectSeminaire.id },
		update: {},
		create: {
			amount: 3000.0,
			limitCriteria: 80.0,
			projectId: projectSeminaire.id,
		},
	});

	for (const op of [
		{
			id: 60,
			name: "Hôtel 2 nuits équipe",
			amount: 880.0,
			isAmountCalculated: false,
			date: "2026-04-10",
			payerId: pSteve.id,
			categoryId: hebergement.id,
			split: [
				{ participantId: pSteve.id, amount: 220.0, isCalculated: true },
				{ participantId: pThomas.id, amount: 220.0, isCalculated: true },
				{ participantId: pLea.id, amount: 220.0, isCalculated: true },
				{ participantId: pMarco.id, amount: 220.0, isCalculated: true },
			],
		},
		{
			id: 61,
			name: "Dîner gala",
			amount: 340.0,
			isAmountCalculated: false,
			date: "2026-04-11",
			payerId: pThomas.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 85.0, isCalculated: true },
				{ participantId: pThomas.id, amount: 85.0, isCalculated: true },
				{ participantId: pLea.id, amount: 85.0, isCalculated: true },
				{ participantId: pMarco.id, amount: 85.0, isCalculated: true },
			],
		},
		{
			id: 62,
			name: "Matériel atelier",
			amount: 127.5,
			isAmountCalculated: false,
			date: "2026-04-10",
			payerId: pLea.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 31.88, isCalculated: true },
				{ participantId: pThomas.id, amount: 31.87, isCalculated: true },
				{ participantId: pLea.id, amount: 31.87, isCalculated: true },
				{ participantId: pMarco.id, amount: 31.88, isCalculated: true },
			],
		},
		{
			id: 63,
			name: "Transport groupe",
			amount: 210.0,
			isAmountCalculated: false,
			date: "2026-04-10",
			payerId: pSteve.id,
			categoryId: transport.id,
			split: [
				{ participantId: pSteve.id, amount: 52.5, isCalculated: true },
				{ participantId: pThomas.id, amount: 52.5, isCalculated: true },
				{ participantId: pLea.id, amount: 52.5, isCalculated: true },
				{ participantId: pMarco.id, amount: 52.5, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectSeminaire.id,
			ownerId: steve.id,
		});
	}

	console.log("✅ project 5 seeded — Séminaire tech (Pro_Travail, 0 alerte)");

	// ============================================================
	// PROJECT 6 — Road trip Bretagne (Steve)
	// Type : Voyage ✅
	// Budget : 1800 € / seuil 85 % → non atteint, 0 alerte
	// Participants : Steve, Sophie, Marco, Léa (4)
	// Greedy complexe → 3 transactions
	// Participant seul dans sa répartition (Léa, Airbnb)
	// ============================================================

	const projectBretagne = await prisma.project.upsert({
		where: { id: 6 },
		update: {},
		create: {
			name: "Road trip Bretagne",
			description: "10 jours sur les côtes bretonnes — juillet 2026",
			type: ProjectType.Voyage,
			appUserId: steve.id,
		},
	});

	for (const pid of [pSteve.id, pSophie.id, pMarco.id, pLea.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectBretagne.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectBretagne.id, participantId: pid },
		});
	}

	await prisma.budget.upsert({
		where: { projectId: projectBretagne.id },
		update: {},
		create: {
			amount: 1800.0,
			limitCriteria: 85.0,
			projectId: projectBretagne.id,
		},
	});

	for (const op of [
		{
			id: 70,
			name: "Location voiture",
			amount: 320.0,
			isAmountCalculated: false,
			date: "2026-07-01",
			payerId: pSteve.id,
			categoryId: transport.id,
			split: [
				{ participantId: pSteve.id, amount: 80.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 80.0, isCalculated: true },
				{ participantId: pMarco.id, amount: 80.0, isCalculated: true },
				{ participantId: pLea.id, amount: 80.0, isCalculated: true },
			],
		},
		{
			id: 71,
			name: "Camping 5 nuits",
			amount: 240.0,
			isAmountCalculated: false,
			date: "2026-07-02",
			// Léa ne participe pas au camping (dort en Airbnb séparément)
			payerId: pMarco.id,
			categoryId: hebergement.id,
			split: [
				{ participantId: pSteve.id, amount: 80.0, isCalculated: false },
				{ participantId: pSophie.id, amount: 80.0, isCalculated: false },
				{ participantId: pMarco.id, amount: 80.0, isCalculated: false },
			],
		},
		{
			id: 72,
			name: "Airbnb Léa",
			amount: 150.0,
			isAmountCalculated: false,
			date: "2026-07-02",
			// Léa supporte seule → participant seul dans sa répartition
			payerId: pLea.id,
			categoryId: hebergement.id,
			split: [{ participantId: pLea.id, amount: 150.0, isCalculated: false }],
		},
		{
			id: 73,
			name: "Restaurants",
			amount: 178.5,
			isAmountCalculated: false,
			date: "2026-07-04",
			payerId: pSophie.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 44.63, isCalculated: true },
				{ participantId: pSophie.id, amount: 44.62, isCalculated: true },
				{ participantId: pMarco.id, amount: 44.62, isCalculated: true },
				{ participantId: pLea.id, amount: 44.63, isCalculated: true },
			],
		},
		{
			id: 74,
			name: "Carburant",
			amount: 120.0,
			isAmountCalculated: false,
			date: "2026-07-03",
			payerId: pSteve.id,
			categoryId: transport.id,
			split: [
				{ participantId: pSteve.id, amount: 30.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 30.0, isCalculated: true },
				{ participantId: pMarco.id, amount: 30.0, isCalculated: true },
				{ participantId: pLea.id, amount: 30.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectBretagne.id,
			ownerId: steve.id,
		});
	}

	console.log(
		"✅ project 6 seeded — Road trip Bretagne (greedy 4 participants)",
	);

	// ============================================================
	// PROJECT 7 — Cuisine du monde (Steve)
	// Type : Repas_Sortie ✅
	// Sans budget → test filtre catégorie Overview (tout en Courses)
	// Participants : Steve, Sophie, Nina, Paul (4)
	// ============================================================

	const projectCuisine = await prisma.project.upsert({
		where: { id: 7 },
		update: {},
		create: {
			name: "Cuisine du monde",
			description: "Soirées thématiques cuisine entre amis",
			type: ProjectType.Repas_Sortie,
			appUserId: steve.id,
		},
	});

	for (const pid of [pSteve.id, pSophie.id, pNina.id, pPaul.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectCuisine.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectCuisine.id, participantId: pid },
		});
	}

	for (const op of [
		{
			id: 80,
			name: "Soirée japonaise",
			amount: 67.3,
			isAmountCalculated: false,
			date: "2026-03-15",
			payerId: pSophie.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 16.83, isCalculated: true },
				{ participantId: pSophie.id, amount: 16.82, isCalculated: true },
				{ participantId: pNina.id, amount: 16.82, isCalculated: true },
				{ participantId: pPaul.id, amount: 16.83, isCalculated: true },
			],
		},
		{
			id: 81,
			name: "Soirée mexicaine",
			amount: 54.9,
			isAmountCalculated: false,
			date: "2026-04-05",
			payerId: pSteve.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 13.73, isCalculated: true },
				{ participantId: pSophie.id, amount: 13.72, isCalculated: true },
				{ participantId: pNina.id, amount: 13.72, isCalculated: true },
				{ participantId: pPaul.id, amount: 13.73, isCalculated: true },
			],
		},
		{
			id: 82,
			name: "Soirée indienne",
			amount: 71.0,
			isAmountCalculated: false,
			date: "2026-05-03",
			payerId: pNina.id,
			categoryId: courses.id,
			split: [
				{ participantId: pSteve.id, amount: 17.75, isCalculated: true },
				{ participantId: pSophie.id, amount: 17.75, isCalculated: true },
				{ participantId: pNina.id, amount: 17.75, isCalculated: true },
				{ participantId: pPaul.id, amount: 17.75, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectCuisine.id,
			ownerId: steve.id,
		});
	}

	console.log("✅ project 7 seeded — Cuisine du monde (sans budget)");

	// ============================================================
	// PROJECT 8 — Réno appart (Steve)
	// Type : Maison_Coloc ✅
	// Budget : 5000 € / seuil 90 % → 1930 € → très loin du seuil
	// 2 participants → 1 transaction greedy
	// ============================================================

	const projectReno = await prisma.project.upsert({
		where: { id: 8 },
		update: {},
		create: {
			name: "Réno appart",
			description: "Travaux de rénovation de l'appartement de Steve",
			type: ProjectType.Maison_Coloc,
			appUserId: steve.id,
		},
	});

	for (const pid of [pSteve.id, pMarco.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectReno.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectReno.id, participantId: pid },
		});
	}

	await prisma.budget.upsert({
		where: { projectId: projectReno.id },
		update: {},
		create: { amount: 5000.0, limitCriteria: 90.0, projectId: projectReno.id },
	});

	for (const op of [
		{
			id: 90,
			name: "Peinture salon",
			amount: 280.0,
			isAmountCalculated: false,
			date: "2026-02-10",
			payerId: pSteve.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 140.0, isCalculated: true },
				{ participantId: pMarco.id, amount: 140.0, isCalculated: true },
			],
		},
		{
			id: 91,
			name: "Parquet chambre",
			amount: 1200.0,
			isAmountCalculated: false,
			date: "2026-02-15",
			payerId: pMarco.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 600.0, isCalculated: true },
				{ participantId: pMarco.id, amount: 600.0, isCalculated: true },
			],
		},
		{
			id: 92,
			name: "Électricien",
			amount: 450.0,
			isAmountCalculated: false,
			date: "2026-03-01",
			payerId: pSteve.id,
			categoryId: divers.id,
			split: [
				{ participantId: pSteve.id, amount: 225.0, isCalculated: true },
				{ participantId: pMarco.id, amount: 225.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectReno.id,
			ownerId: steve.id,
		});
	}

	console.log("✅ project 8 seeded — Réno appart (2 participants)");

	// ============================================================
	// PROJECT 9 — Festival été 2024 (Steve) — ARCHIVÉ
	// Type : Autre ✅
	// Sans budget — projet clos
	// ============================================================

	const projectFestival = await prisma.project.upsert({
		where: { id: 9 },
		update: {},
		create: {
			name: "Festival été 2024",
			description: "Hellfest avec les potes — édition 2024",
			type: ProjectType.Autre,
			appUserId: steve.id,
			isArchived: true,
		},
	});

	for (const pid of [pSteve.id, pJerem.id, pThomas.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectFestival.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectFestival.id, participantId: pid },
		});
	}

	for (const op of [
		{
			id: 100,
			name: "Pass 3 jours x3",
			amount: 450.0,
			isAmountCalculated: false,
			date: "2024-06-20",
			payerId: pSteve.id,
			categoryId: loisir.id,
			split: [
				{ participantId: pSteve.id, amount: 150.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 150.0, isCalculated: true },
				{ participantId: pThomas.id, amount: 150.0, isCalculated: true },
			],
		},
		{
			id: 101,
			name: "Camping sur place",
			amount: 90.0,
			isAmountCalculated: false,
			date: "2024-06-20",
			payerId: pJerem.id,
			categoryId: hebergement.id,
			split: [
				{ participantId: pSteve.id, amount: 30.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 30.0, isCalculated: true },
				{ participantId: pThomas.id, amount: 30.0, isCalculated: true },
			],
		},
		{
			id: 102,
			name: "Nourriture festival",
			amount: 138.0,
			isAmountCalculated: false,
			date: "2024-06-21",
			payerId: pThomas.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 46.0, isCalculated: true },
				{ participantId: pJerem.id, amount: 46.0, isCalculated: true },
				{ participantId: pThomas.id, amount: 46.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectFestival.id,
			ownerId: steve.id,
		});
	}

	console.log("✅ project 9 seeded — Festival 2024 (archivé, Autre)");

	// ============================================================
	// PROJECT 10 — Vacances Espagne 2023 (Steve) — ARCHIVÉ
	// Type : Voyage ✅ — second projet archivé
	// Avec budget — pour tester l'affichage budget sur projet archivé
	// ============================================================

	const projectEspagne = await prisma.project.upsert({
		where: { id: 10 },
		update: {},
		create: {
			name: "Vacances Espagne 2023",
			description: "2 semaines à Barcelone et Séville",
			type: ProjectType.Voyage,
			appUserId: steve.id,
			isArchived: true,
		},
	});

	for (const pid of [pSteve.id, pAurore.id, pLudo.id, pSophie.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectEspagne.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectEspagne.id, participantId: pid },
		});
	}

	await prisma.budget.upsert({
		where: { projectId: projectEspagne.id },
		update: {},
		create: {
			amount: 2000.0,
			limitCriteria: 80.0,
			projectId: projectEspagne.id,
		},
	});

	for (const op of [
		{
			id: 110,
			name: "Vols aller-retour",
			amount: 480.0,
			isAmountCalculated: false,
			date: "2023-07-10",
			payerId: pSteve.id,
			categoryId: transport.id,
			split: [
				{ participantId: pSteve.id, amount: 120.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 120.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 120.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 120.0, isCalculated: true },
			],
		},
		{
			id: 111,
			name: "Appartement Barcelone",
			amount: 840.0,
			isAmountCalculated: false,
			date: "2023-07-10",
			payerId: pAurore.id,
			categoryId: hebergement.id,
			split: [
				{ participantId: pSteve.id, amount: 210.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 210.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 210.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 210.0, isCalculated: true },
			],
		},
		{
			id: 112,
			name: "Restaurants et tapas",
			amount: 320.0,
			isAmountCalculated: false,
			date: "2023-07-15",
			payerId: pLudo.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pSteve.id, amount: 80.0, isCalculated: true },
				{ participantId: pAurore.id, amount: 80.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 80.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 80.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectEspagne.id,
			ownerId: steve.id,
		});
	}

	console.log(
		"✅ project 10 seeded — Vacances Espagne 2023 (archivé avec budget)",
	);

	// ╔══════════════════════════════════════════════════════════╗
	// ║              PROJETS D'AURORE                           ║
	// ║  Compte test 403 — aurore@lapince.fr / password123     ║
	// ╚══════════════════════════════════════════════════════════╝

	// ============================================================
	// PROJECT 11 — Coloc bd Voltaire (Aurore)
	// Type : Maison_Coloc ✅
	// Budget : 1500 € / seuil 80 % → alerte UNREAD
	// Participants : Aurore, Nina, Paul (3)
	// ============================================================

	const projectColocAurore = await prisma.project.upsert({
		where: { id: 11 },
		update: {},
		create: {
			name: "Coloc bd Voltaire",
			description: "Charges communes de la coloc d'Aurore",
			type: ProjectType.Maison_Coloc,
			appUserId: aurore.id,
		},
	});

	for (const pid of [pAurore.id, pNina.id, pPaul.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectColocAurore.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectColocAurore.id, participantId: pid },
		});
	}

	const budgetColocAurore = await prisma.budget.upsert({
		where: { projectId: projectColocAurore.id },
		update: {},
		create: {
			amount: 1500.0,
			limitCriteria: 80.0,
			projectId: projectColocAurore.id,
		},
	});

	for (const op of [
		{
			id: 120,
			name: "Loyer mai",
			amount: 900.0,
			isAmountCalculated: false,
			date: "2026-05-01",
			payerId: pAurore.id,
			categoryId: divers.id,
			split: [
				{ participantId: pAurore.id, amount: 300.0, isCalculated: true },
				{ participantId: pNina.id, amount: 300.0, isCalculated: true },
				{ participantId: pPaul.id, amount: 300.0, isCalculated: true },
			],
		},
		{
			id: 121,
			name: "EDF mai",
			amount: 78.0,
			isAmountCalculated: false,
			date: "2026-05-10",
			payerId: pNina.id,
			categoryId: divers.id,
			split: [
				{ participantId: pAurore.id, amount: 26.0, isCalculated: true },
				{ participantId: pNina.id, amount: 26.0, isCalculated: true },
				{ participantId: pPaul.id, amount: 26.0, isCalculated: true },
			],
		},
		{
			id: 122,
			name: "Courses communes",
			amount: 245.0,
			isAmountCalculated: false,
			date: "2026-05-15",
			payerId: pPaul.id,
			categoryId: courses.id,
			split: [
				{ participantId: pAurore.id, amount: 81.67, isCalculated: true },
				{ participantId: pNina.id, amount: 81.67, isCalculated: true },
				{ participantId: pPaul.id, amount: 81.66, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectColocAurore.id,
			ownerId: aurore.id,
		});
	}

	// 1223 € > 80 % de 1500 € (= 1200 €) → alerte unread
	await seedAlert({
		id: 4,
		status: "unread",
		threshold: 80,
		totalSpent: 1223.0,
		budgetAmount: 1500.0,
		budgetId: budgetColocAurore.id,
		userId: aurore.id,
	});

	console.log(
		"✅ project 11 seeded — Coloc bd Voltaire (Aurore, alerte unread)",
	);

	// ============================================================
	// PROJECT 12 — Week-end Lyon (Aurore)
	// Type : Voyage ✅
	// Sans budget
	// Participants : Aurore, Ludo, Sophie (3)
	// ============================================================

	const projectLyon = await prisma.project.upsert({
		where: { id: 12 },
		update: {},
		create: {
			name: "Week-end Lyon",
			description: "Escapade gastronomique à Lyon",
			type: ProjectType.Voyage,
			appUserId: aurore.id,
		},
	});

	for (const pid of [pAurore.id, pLudo.id, pSophie.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectLyon.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectLyon.id, participantId: pid },
		});
	}

	for (const op of [
		{
			id: 130,
			name: "Train Lyon",
			amount: 108.0,
			isAmountCalculated: false,
			date: "2026-03-20",
			payerId: pAurore.id,
			categoryId: transport.id,
			split: [
				{ participantId: pAurore.id, amount: 36.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 36.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 36.0, isCalculated: true },
			],
		},
		{
			id: 131,
			name: "Hôtel 2 nuits",
			amount: 210.0,
			isAmountCalculated: false,
			date: "2026-03-20",
			payerId: pSophie.id,
			categoryId: hebergement.id,
			split: [
				{ participantId: pAurore.id, amount: 70.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 70.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 70.0, isCalculated: true },
			],
		},
		{
			id: 132,
			name: "Bouchon lyonnais",
			amount: 93.0,
			isAmountCalculated: false,
			date: "2026-03-21",
			payerId: pLudo.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pAurore.id, amount: 31.0, isCalculated: true },
				{ participantId: pLudo.id, amount: 31.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 31.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectLyon.id,
			ownerId: aurore.id,
		});
	}

	console.log("✅ project 12 seeded — Week-end Lyon (Aurore, sans budget)");

	// ============================================================
	// PROJECT 13 — Repas entre filles (Aurore)
	// Type : Repas_Sortie ✅
	// Sans budget — projet simple
	// Participants : Aurore, Sophie, Nina (3)
	// ============================================================

	const projectRepas = await prisma.project.upsert({
		where: { id: 13 },
		update: {},
		create: {
			name: "Repas entre filles",
			description: "Dîners mensuels entre amies",
			type: ProjectType.Repas_Sortie,
			appUserId: aurore.id,
		},
	});

	for (const pid of [pAurore.id, pSophie.id, pNina.id]) {
		await prisma.projectParticipant.upsert({
			where: {
				projectId_participantId: {
					projectId: projectRepas.id,
					participantId: pid,
				},
			},
			update: {},
			create: { projectId: projectRepas.id, participantId: pid },
		});
	}

	for (const op of [
		{
			id: 140,
			name: "Restaurant japonais",
			amount: 75.0,
			isAmountCalculated: false,
			date: "2026-02-14",
			payerId: pAurore.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pAurore.id, amount: 25.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 25.0, isCalculated: true },
				{ participantId: pNina.id, amount: 25.0, isCalculated: true },
			],
		},
		{
			id: 141,
			name: "Dîner thaïlandais",
			amount: 69.0,
			isAmountCalculated: false,
			date: "2026-03-14",
			payerId: pSophie.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pAurore.id, amount: 23.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 23.0, isCalculated: true },
				{ participantId: pNina.id, amount: 23.0, isCalculated: true },
			],
		},
		{
			id: 142,
			name: "Cocktails bar",
			amount: 48.0,
			isAmountCalculated: false,
			date: "2026-04-14",
			payerId: pNina.id,
			categoryId: restaurants.id,
			split: [
				{ participantId: pAurore.id, amount: 16.0, isCalculated: true },
				{ participantId: pSophie.id, amount: 16.0, isCalculated: true },
				{ participantId: pNina.id, amount: 16.0, isCalculated: true },
			],
		},
	]) {
		await seedOperation({
			...op,
			projectId: projectRepas.id,
			ownerId: aurore.id,
		});
	}

	console.log(
		"✅ project 13 seeded — Repas entre filles (Aurore, sans budget)",
	);

	// ============================================================
	// RÉSUMÉ
	// ============================================================
	//
	// ┌─────────────────────────────────────────────────────────┐
	// │ steve@lapince.fr  / password123  → 10 projets          │
	// │ aurore@lapince.fr / password123  → 3 projets (test 403)│
	// └─────────────────────────────────────────────────────────┘
	//
	// PROJETS STEVE :
	//   1  Voyage Milan         Voyage        budget  alerte UNREAD   15 ops pagination
	//   2  Coloc rue Pasteur    Maison_Coloc  budget  alerte READ     15 ops pagination
	//   3  Anniversaire Sophie  Anniversaire  budget  alerte RESOLVED répartition inégale
	//   4  Soirée raclette      Repas_Sortie  -       -               balances nulles
	//   5  Séminaire tech       Pro_Travail   budget  -               4 participants
	//   6  Road trip Bretagne   Voyage        budget  -               greedy complexe
	//   7  Cuisine du monde     Repas_Sortie  -       -               filtre catégorie
	//   8  Réno appart          Maison_Coloc  budget  -               2 participants
	//   9  Festival 2024        Autre         -       -               ARCHIVÉ sans budget
	//  10  Vacances Espagne     Voyage        budget  -               ARCHIVÉ avec budget
	//
	// PROJETS AURORE :
	//  11  Coloc bd Voltaire    Maison_Coloc  budget  alerte UNREAD
	//  12  Week-end Lyon        Voyage        -       -
	//  13  Repas entre filles   Repas_Sortie  -       -
	//
	// CAS MÉTIER COUVERTS :
	//   ✅ Tous les ProjectType
	//   ✅ 3 statuts d'alerte (unread, read, resolved)
	//   ✅ 2 projets archivés (avec et sans budget)
	//   ✅ Projets sans budget
	//   ✅ Pagination (~15 ops sur projects 1 et 2)
	//   ✅ Payeur absent de sa répartition (project 1 op 5)
	//   ✅ Répartition inégale (project 3 op 1)
	//   ✅ Participant seul dans répartition (project 6 op 3)
	//   ✅ Balances nulles (project 4)
	//   ✅ Greedy 2, 3, 4 participants
	//   ✅ KPI Steve à recevoir (projects 1, 2) et à payer (project 3)
	//   ✅ Test 403 : token Aurore sur projets Steve → accès refusé
	//
	// ============================================================

	// Reset all sequences to avoid conflicts with explicit IDs
	await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('alert', 'id'), (SELECT MAX(id) FROM alert))`;
	await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('participant', 'id'), (SELECT MAX(id) FROM participant))`;
	await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('project', 'id'), (SELECT MAX(id) FROM project))`;
	await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('operation', 'id'), (SELECT MAX(id) FROM operation))`;
	await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('app_user', 'id'), (SELECT MAX(id) FROM app_user))`;
	await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('budget', 'id'), (SELECT MAX(id) FROM budget))`;
	console.log("✅ Sequences reset");
	console.log("🎉 Seeding complete!");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
