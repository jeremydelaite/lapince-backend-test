import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { Prisma } from "../../generated/prisma";
import { envConfig } from "../config/env.config";
import { ConflictError, UnauthorizedError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema";

type RegisterUserResult = {
	user: {
		id: number;
		name: string;
		email: string;
	};
	project: any;
	budget: any;
	alert: any;
	token: string;
};

export async function registerUser(
	data: RegisterInput,
): Promise<RegisterUserResult> {
	const existingUser = await prisma.appUser.findUnique({
		where: { email: data.email },
	});

	if (existingUser) {
		throw new ConflictError("Cet email est déjà utilisé");
	}

	const hashedPassword = await argon2.hash(data.password);

	const result = await prisma.$transaction(async (tx) => {
		// 1. CREATE USER
		const user = await tx.appUser.create({
			data: {
				name: data.name,
				email: data.email,
				password: hashedPassword,
			},
		});

		// 2. CREATE DEMO PARTICIPANTS
		const participants = await Promise.all([
			tx.participant.create({ data: { name: "Alice" } }),
			tx.participant.create({ data: { name: "Bob" } }),
			tx.participant.create({ data: { name: "Charlie" } }),
		]);

		// 3. CREATE DEMO PROJECT (renamed)
		const project = await tx.project.create({
			data: {
				name: "Projet de démonstration - Gestion de dépenses",
				description:
					"Projet fictif permettant de découvrir l’application. Il peut être supprimé à tout moment depuis l’onglet détail du projet.",
				type: "Voyage",
				appUserId: user.id,
			},
		});

		// 4. CREATE BUDGET (NEW)
		const budget = await tx.budget.create({
			data: {
				amount: new Prisma.Decimal("300.00"),
				limitCriteria: new Prisma.Decimal("80.00"),
				projectId: project.id,
			},
		});

		// 5. CREATE BUDGET ALERT (NEW - triggered state)
		const alert = await tx.alert.create({
			data: {
				status: "unread",
				message: "Alerte déclenchée sur budget de démonstration",
				budgetId: budget.id,
			},
		});
		// Link alert to user
		await tx.appUserAlert.create({
			data: {
				appUserId: user.id,
				alertId: alert.id,
			},
		});

		// Link participants to project
		await tx.projectParticipant.createMany({
			data: participants.map((p) => ({
				projectId: project.id,
				participantId: p.id,
			})),
		});

		// 6. DEMO OPERATIONS CONFIGURATION
		const demoOperations = [
			{ name: "Hôtel", amount: new Prisma.Decimal(180), payerIndex: 0, categoryId: 4 },
			{ name: "Restaurant", amount: new Prisma.Decimal(90), payerIndex: 1, categoryId: 3 },
			{ name: "Courses", amount: new Prisma.Decimal(45), payerIndex: 2, categoryId: 6 },
		];

		// 7. CREATE OPERATIONS + SPLITS
		for (const op of demoOperations) {
			const operation = await tx.operation.create({
				data: {
					name: op.name,
					amount: op.amount,
					isAmountCalculated: false,
					date: new Date(),
					payerParticipantId: participants[op.payerIndex].id,
					appUserId: user.id,
					categoryId: op.categoryId,
					projectId: project.id,
				},
			});

			const splitAmount = op.amount.div(participants.length);

			await tx.operationParticipant.createMany({
				data: participants.map((p) => ({
					operationId: operation.id,
					participantId: p.id,
					repartitionAmount: splitAmount,
					isRepartitionAmountCalculated: true,
				})),
			});
		}

		// 8. RETURN RESULT
		return {
			user,
			project,
			budget,
			alert,
		};
	});

	// Add : token creation for automatique redirect
	const token = jwt.sign({ userId: result.user.id }, envConfig.jwtSecret, {
		expiresIn: "7d",
	});

	return {
		user: {
			id: result.user.id,
			name: result.user.name,
			email: result.user.email,
		},
		project: result.project,
		budget: result.budget,
		alert: result.alert,
		token,
	};
}

export async function loginUser(data: LoginInput) {
	const user = await prisma.appUser.findUnique({
		where: { email: data.email },
	});

	if (!user) {
		throw new UnauthorizedError("Email ou mot de passe incorrect");
	}

	const isValid = await argon2.verify(user.password, data.password);
	if (!isValid) {
		throw new UnauthorizedError("Email ou mot de passe incorrect");
	}

	const token = jwt.sign({ userId: user.id }, envConfig.jwtSecret, {
		expiresIn: "7d",
	});

	return {
		user: { id: user.id, name: user.name, email: user.email },
		token,
	};
}

export async function getMe(userId: number) {
	const user = await prisma.appUser.findUnique({
		where: { id: userId },
		select: { id: true, name: true, email: true },
	});

	if (!user) {
		throw new UnauthorizedError("Utilisateur introuvable");
	}

	return user;
}
