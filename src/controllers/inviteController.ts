import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Invitation from "../models/Invitation";
import {
  generateRandomToken,
  generateRefreshToken,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "../utils/generateToken";
import { sendInvitationEmail } from "../utils/email";
import { AppError } from "../middleware/errorHandler";

// Helper: Set Auth Cookies
const sendAuthCookies = (
  res: Response,
  userId: string,
  role: string,
  refreshToken: string
): string => {
  const { generateAccessToken } = require("../utils/generateToken");
  const accessToken = generateAccessToken(userId, role);
  res.cookie("access_token", accessToken, accessTokenCookieOptions);
  res.cookie("refresh_token", refreshToken, refreshTokenCookieOptions);
  return accessToken;
};

// ─── SEND TEAM INVITATION ─────────────────────────────────────────────────────
export const sendInvite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, role } = req.body as {
      email: string;
      role: "admin" | "editor" | "viewer";
    };

    if (!email || !role) {
      throw new AppError("Email and role are required", 400);
    }

    if (!["admin", "editor", "viewer"].includes(role)) {
      throw new AppError("Invalid role specified", 400);
    }

    // Determine current user's shop ID (which is their sellerId if they are a member, or their own ID if they are the owner)
    const sellerId = req.user!.sellerId || req.user!._id;

    // Only owners/sellers and admins can invite members
    const currentRole = req.user!.role;
    if (
      currentRole !== "owner" &&
      currentRole !== "seller" &&
      currentRole !== "admin"
    ) {
      throw new AppError("You do not have permission to invite members", 403);
    }

    // Check if the user is already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError(
        "A user with this email address is already registered",
        400
      );
    }

    // Check if there is an active pending invitation
    const existingInvite = await Invitation.findOne({
      email: email.toLowerCase(),
      sellerId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (existingInvite) {
      throw new AppError(
        "An invitation has already been sent to this email address",
        400
      );
    }

    // Create unique token
    const token = generateRandomToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const invitation = await Invitation.create({
      email: email.toLowerCase().trim(),
      role,
      token,
      invitedBy: req.user!._id,
      sellerId,
      expiresAt,
    });

    // Send invitation email and rollback if email delivery fails
    const shopName = req.user!.shopName || "ve-admin Store";
    try {
      await sendInvitationEmail(
        invitation.email,
        req.user!.name,
        shopName,
        token
      );
    } catch (error) {
      await Invitation.findByIdAndDelete(invitation._id).catch(
        (deleteError) => {
          console.error(
            "❌  Failed to delete invitation after email send failure:",
            deleteError
          );
        }
      );
      throw error;
    }

    res.status(200).json({
      success: true,
      message: `Invitation successfully sent to ${invitation.email}`,
      data: invitation,
    });
  } catch (error) {
    next(error);
  }
};

// ─── VERIFY INVITATION TOKEN ──────────────────────────────────────────────────
export const verifyInviteToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.query as { token: string };

    if (!token) {
      throw new AppError("Invitation token is required", 400);
    }

    const invitation = await Invitation.findOne({
      token,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).populate("sellerId", "shopName");

    if (!invitation) {
      throw new AppError(
        "This invitation link is invalid or has expired.",
        400
      );
    }

    const seller = invitation.sellerId as any;

    res.status(200).json({
      success: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        shopName: seller?.shopName || "ve-admin Store",
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── ONBOARD INVITED MEMBER ───────────────────────────────────────────────────
export const onboardMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, name, password } = req.body as {
      token: string;
      name: string;
      password: string;
    };

    if (!token || !name || !password) {
      throw new AppError(
        "All fields (token, name, password) are required",
        400
      );
    }

    if (password.length < 8) {
      throw new AppError("Password must be at least 8 characters", 400);
    }

    // Find invitation
    const invitation = await Invitation.findOne({
      token,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      throw new AppError(
        "This invitation link is invalid or has expired.",
        400
      );
    }

    // Ensure email is not already taken
    const existingUser = await User.findOne({ email: invitation.email });
    if (existingUser) {
      throw new AppError(
        "A user with this email address has already registered",
        400
      );
    }

    // Fetch the inviter's shop properties
    const owner = await User.findById(invitation.sellerId);
    if (!owner) {
      throw new AppError(
        "Inviting store owner account could not be found",
        400
      );
    }

    // Pre-generate ID and refreshToken
    const memberId = new mongoose.Types.ObjectId();
    const refreshToken = generateRefreshToken(memberId);

    // Create the team member user
    const member = await User.create({
      _id: memberId,
      name: name.trim(),
      email: invitation.email,
      password,
      role: invitation.role,
      sellerId: invitation.sellerId, // points to shop owner
      shopName: owner.shopName,
      shopLogo: owner.shopLogo,
      isEmailVerified: true, // already verified via invitation link click
      refreshToken,
    });

    // Accept the invitation
    invitation.status = "accepted";
    await invitation.save();

    const accessToken = sendAuthCookies(res, member._id.toString(), member.role, refreshToken);

    res.status(201).json({
      success: true,
      message: "Onboarding completed successfully! Welcome to the team.",
      token: accessToken,
      refreshToken: refreshToken,
      data: {
        _id: member._id,
        name: member.name,
        email: member.email,
        shopName: member.shopName,
        shopLogo: member.shopLogo,
        role: member.role,
        isEmailVerified: member.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET TEAM MEMBERS AND INVITATIONS ─────────────────────────────────────────
export const getTeamMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;

    // Fetch active members (owner + anyone belonging to this sellerId)
    const members = await User.find({
      $or: [{ _id: sellerId }, { sellerId: sellerId }],
    }).select("name email role createdAt");

    // Fetch pending invitations
    const pendingInvites = await Invitation.find({
      sellerId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).select("email role status expiresAt createdAt");

    res.status(200).json({
      success: true,
      data: {
        members,
        pendingInvites,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── REMOVE TEAM MEMBER ───────────────────────────────────────────────────────
export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const sellerId = req.user!.sellerId || req.user!._id;

    // Only shop owners can remove members
    if (req.user!.role !== "owner" && req.user!.role !== "seller") {
      throw new AppError("Only the store owner can remove team members", 403);
    }

    if (id === sellerId.toString()) {
      throw new AppError(
        "You cannot remove yourself (the store owner) from the team",
        400
      );
    }

    const member = await User.findOneAndDelete({ _id: id, sellerId });
    if (!member) {
      throw new AppError("Team member not found", 404);
    }

    res.status(200).json({
      success: true,
      message: `Team member ${member.name} has been removed from the store`,
    });
  } catch (error) {
    next(error);
  }
};

// ─── REVOKE PENDING INVITATION ────────────────────────────────────────────────
export const revokeInvite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    // Only owners and admins can revoke invitations
    const currentRole = req.user!.role;
    if (
      currentRole !== "owner" &&
      currentRole !== "seller" &&
      currentRole !== "admin"
    ) {
      throw new AppError(
        "You do not have permission to revoke invitations",
        403
      );
    }

    const invite = await Invitation.findOneAndDelete({ _id: id, sellerId });
    if (!invite) {
      throw new AppError("Invitation not found", 404);
    }

    res.status(200).json({
      success: true,
      message: `Invitation to ${invite.email} has been revoked`,
    });
  } catch (error) {
    next(error);
  }
};
