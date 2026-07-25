import { PlusIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { PLATFORMS } from "../assets/assets";
import AccountList from "../components/AccountsList";
import PlatformPickerModal from "../components/PlatformPickerModal";
import toast from "react-hot-toast";
import api from "../api/axios";

const Accounts = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showPlatformPicker, setShowPlatformPicker] = useState<boolean>(false);

  const handleDisconnect = async (accountId: string) => {
    try {
      await api.delete(`/accounts/${accountId}`);
      toast.success("Account disconnected");
      await fetchAccounts();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to disconnect account",
      );
    }
  };

  // ✅ FIXED: Better error handling for OAuth
  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    console.log(`🔵 Connecting to ${platformId}...`);

    try {
      // ✅ Check if token exists before making the call
      const token = localStorage.getItem("token");
      console.log(`🔵 Token exists: ${!!token}`);

      if (!token) {
        console.log("🔴 No token found - redirecting to login");
        toast.error("Please login first");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
        setConnecting(null);
        return;
      }

      console.log(`🔵 Making API call to /oauth/${platformId}/url`);
      const { data } = await api.get(`/oauth/${platformId}/url`);
      console.log(`🔵 Response received:`, data);

      if (!data.url) {
        throw new Error("No authorization URL received from server");
      }

      console.log(`🔵 Redirecting to: ${data.url}`);
      // ✅ Store current path to return after OAuth
      sessionStorage.setItem("oauth_redirect", window.location.pathname);
      window.location.href = data.url;
    } catch (error: any) {
      console.log("🔴 OAuth Error:", error);

      // ✅ Handle 401 specifically
      if (error?.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
      } else {
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            `Failed to connect ${platformId}`,
        );
      }
      setConnecting(null);
    }
  };

  const fetchAccounts = async (
    isSync = false,
    platform?: string | null,
    successMsg?: string,
  ) => {
    try {
      if (isSync) {
        const label = platform
          ? platform.charAt(0).toUpperCase() + platform.slice(1)
          : "Social Media";
        toast.loading(`Syncing ${label} account...`, { id: "sync" });
        await api.get("/oauth/sync");
        toast.success(successMsg || "Accounts synced!", { id: "sync" });
      }

      const { data } = await api.get("/accounts");
      setAccounts(data);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load accounts",
      );
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedPlatform = params.get("connected");
    const connectedUsername = params.get("username");
    const syncNeeded = params.get("sync") === "true";
    const errorMsg = params.get("error");

    // ✅ Check if we're returning from OAuth
    if (connectedPlatform || syncNeeded || errorMsg) {
      console.log("🔵 Returning from OAuth flow");

      // ✅ Clear the OAuth redirect flag
      sessionStorage.removeItem("oauth_redirect");

      // ✅ Check if token still exists
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("🔴 No token found after OAuth redirect");
        toast.error("Session expired. Please login again.");
        window.location.href = "/login";
        return;
      }
    }

    window.history.replaceState({}, document.title, window.location.pathname);

    if (connectedPlatform) {
      const label =
        connectedPlatform.charAt(0).toUpperCase() + connectedPlatform.slice(1);
      const handle = connectedUsername ? ` (@${connectedUsername})` : "";
      fetchAccounts(true, connectedPlatform, `${label}${handle} connected!`);
    } else if (errorMsg) {
      toast.error(`Connection failed: ${decodeURIComponent(errorMsg)}`);
      fetchAccounts();
    } else if (syncNeeded) {
      fetchAccounts(true, null, "Accounts synced!");
    } else {
      fetchAccounts();
    }
  }, []);

  const connectedIds = accounts.map((a) => a.platform);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm">
        <div>
          <h2 className="text-xl text-slate-900">Connected Accounts</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {accounts.length} of {PLATFORMS.length} platforms connected
          </p>
        </div>
        <button
          onClick={() => setShowPlatformPicker(true)}
          disabled={!!connecting}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-all w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connecting ? (
            <>
              <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <PlusIcon className="size-4" /> Connect Account
            </>
          )}
        </button>
      </div>

      {showPlatformPicker && (
        <PlatformPickerModal
          connectedIds={connectedIds}
          connecting={connecting}
          onClose={() => setShowPlatformPicker(false)}
          onConnect={handleConnect}
        />
      )}

      <AccountList accounts={accounts} onDisconnect={handleDisconnect} />
    </div>
  );
};

export default Accounts;
