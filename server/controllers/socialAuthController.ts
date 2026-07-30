import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddlerware.js";
import zernio from "../config/zernio.js";
import { User } from "../models/User.js";
import { Account } from "../models/Accounts.js";

const getOrCreateZernioProfile = async (user: any): Promise<string> => {
  try {
    console.log("🔵 [ZERNIO] Getting/Creating profile for user:", user._id);

    if (!user || !user._id) {
      throw new Error("User is not authenticated or user ID is missing");
    }

    if (user.zernioProfileId) {
      console.log("✅ [ZERNIO] Using existing profile:", user.zernioProfileId);
      return user.zernioProfileId;
    }

    const result = await zernio.profiles.listProfiles();
    const data = result.data as any;
    const profiles: any[] = Array.isArray(data)
      ? data
      : data?.profiles || data?.data || [];

    if (profiles.length > 0) {
      const pid = profiles[0]._id || profiles[0].id;
      if (!pid) {
        throw new Error("Profile ID not found in existing profile");
      }
      await User.findByIdAndUpdate(user._id, { zernioProfileId: pid });
      console.log("✅ [ZERNIO] Using existing profile:", pid);
      return pid;
    }

    console.log("🔵 [ZERNIO] Creating new profile...");
    const createResult = await zernio.profiles.createProfile({
      body: { name: `${user.name || user.email || "User"}'s workspace` } as any,
    });
    const created = (createResult.data as any)?.profile || createResult.data;
    const pid = created?._id || created?.id;

    if (!pid) {
      throw new Error("Failed to create Zernio profile - no ID returned");
    }

    await User.findByIdAndUpdate(user._id, { zernioProfileId: pid });
    console.log("✅ [ZERNIO] Created new profile:", pid);
    return pid;
  } catch (error: any) {
    console.error("❌ [ZERNIO] Error:", error?.message || error);
    throw error;
  }
};

// ✅ FIXED: generateAuthUrl with better error handling
export const generateAuthUrl = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔵 [OAUTH] generateAuthUrl called");
    console.log("🔵 [OAUTH] Platform:", req.params.platform);
    console.log("🔵 [OAUTH] req.user type:", typeof req.user);
    console.log("🔵 [OAUTH] req.user value:", req.user);
    console.log("🔵 [OAUTH] req.user exists?", !!req.user);
    console.log("🔵 [OAUTH] req.user._id exists?", !!req.user?._id);

    // ✅ FIX: Check if user exists and has an _id
    if (!req.user) {
      console.log("🔴 [OAUTH] No user object on request");
      res.status(401).json({
        message: "User not authenticated - no user object",
        details: "Middleware did not attach user to request",
      });
      return;
    }

    if (!req.user._id) {
      console.log("🔴 [OAUTH] User object exists but no _id:", req.user);
      res.status(401).json({
        message: "User not authenticated - missing user ID",
        details: "User object is missing _id field",
      });
      return;
    }

    console.log(`✅ [OAUTH] User ID found: ${req.user._id}`);
    console.log(`✅ [OAUTH] User email: ${req.user.email}`);

    const { platform } = req.params;

    console.log(`🔵 [OAUTH] Getting Zernio profile...`);
    const profileId = await getOrCreateZernioProfile(req.user);
    console.log(`✅ [OAUTH] Profile ID: ${profileId}`);

    const origin = req.headers.origin || "http://localhost:5173";
    const redirectUrl = `${origin}/accounts`;
    console.log(`🔵 [OAUTH] Redirect URL: ${redirectUrl}`);

    console.log(`🔵 [OAUTH] Calling Zernio connect API...`);
    const result = await zernio.connect.getConnectUrl({
      path: { platform: platform as any },
      query: {
        profileId,
        redirect_url: redirectUrl,
      },
    });

    const data = result.data as any;
    console.log("✅ [OAUTH] Zernio response received");

    const authUrl = data.authUrl;
    if (!authUrl) {
      console.log("🔴 [OAUTH] No authUrl in response!");
      throw new Error(
        `Zernio returned no authUrl. Response: ${JSON.stringify(data)}`,
      );
    }

    console.log(`✅ [OAUTH] Auth URL generated successfully`);
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error("❌ [OAUTH] Error:", error?.message || error);
    console.error("❌ [OAUTH] Error stack:", error?.stack);
    res.status(500).json({
      message: error?.message || "Server error",
      details: error?.response?.data || error?.stack,
    });
  }
};

// ✅ FIXED: syncAccounts with proper user check
export const syncAccounts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔵 [SYNC] syncAccounts called");
    console.log("🔵 [SYNC] req.user exists?", !!req.user);
    console.log("🔵 [SYNC] req.user._id exists?", !!req.user?._id);

    if (!req.user || !req.user._id) {
      console.log("🔴 [SYNC] No user found!");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    console.log(`✅ [SYNC] User ID found: ${req.user._id}`);
    const profileId = await getOrCreateZernioProfile(req.user);
    console.log(`✅ [SYNC] Profile ID: ${profileId}`);

    const result = await zernio.accounts.listAccounts({
      query: { profileId } as any,
    });

    const data = result.data as any;
    const zernioAccounts: any[] =
      data?.accounts || (Array.isArray(data) ? data : []);
    console.log(
      `🔵 [SYNC] Found ${zernioAccounts.length} accounts from Zernio`,
    );

    const supportedPlatforms = ["twitter", "linkedin", "facebook", "instagram"];
    const syncedAccounts = [];

    for (const zAccount of zernioAccounts) {
      const zid = zAccount._id || zAccount.id;
      if (!zid) {
        console.warn("⚠️ [SYNC] Skipping account with no ID:", zAccount);
        continue;
      }

      const rawPlatform = (
        zAccount.platform ||
        zAccount.type ||
        ""
      ).toLowerCase();
      const normalizedPlatform = supportedPlatforms.find((p) =>
        rawPlatform.includes(p),
      );
      if (!normalizedPlatform) {
        console.log(
          `⚠️ [SYNC] Skipping unsupported platform: "${rawPlatform}"`,
        );
        continue;
      }

      const account = await Account.findOneAndUpdate(
        { zernioAccountId: zid },
        {
          user: req.user._id,
          platform: normalizedPlatform,
          handle:
            zAccount.username || zAccount.name || zAccount.handle || "Unknown",
          zernioAccountId: zid,
          status: "connected",
          avatarUrl:
            zAccount.avatarUrl ||
            zAccount.picture ||
            zAccount.profile_image_url,
        },
        { upsert: true, returnDocument: "after" },
      );
      syncedAccounts.push(account);
      console.log(
        `✅ [SYNC] Synced ${normalizedPlatform} account: ${account.handle}`,
      );
    }

    console.log(`✅ [SYNC] Synced ${syncedAccounts.length} accounts`);
    res.json(syncedAccounts);
  } catch (error: any) {
    console.error("❌ [SYNC] Error:", error?.message || error);
    res.status(500).json({ message: error?.message || "Server error" });
  }
};
