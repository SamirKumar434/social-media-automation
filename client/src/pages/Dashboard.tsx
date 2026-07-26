import { useState, useEffect } from "react";
import api from "../api/axios";
import {
  ClockIcon,
  CheckCircleIcon,
  Share2Icon,
  TrendingUpIcon,
  ActivityIcon,
  SendIcon,
} from "lucide-react";

const Dashboard = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState({
    scheduled: 0,
    published: 0,
    connectedAccounts: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // ✅ FIXED: Remove /api prefix from all calls
        const [postsRes, accountsRes, activityRes] = await Promise.all([
          api.get("/posts"), // ✅ Goes to: /api/posts
          api.get("/accounts"), // ✅ Goes to: /api/accounts
          api.get("/activity"), // ✅ Goes to: /api/activity
        ]);

        const posts = postsRes.data;

        setStats({
          scheduled: posts.filter((p: any) => p.status === "scheduled").length,
          published: posts.filter((p: any) => p.status === "published").length,
          connectedAccounts: accountsRes.data.filter(
            (a: any) => a.status === "connected",
          ).length,
        });

        setActivities(activityRes.data);
      } catch (error: any) {
        console.error("❌ Error fetching dashboard data", error);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    {
      label: "Scheduled Posts",
      value: stats.scheduled,
      icon: ClockIcon,
      trend: "+2 today",
    },
    {
      label: "Published Posts",
      value: stats.published,
      icon: CheckCircleIcon,
      trend: "All time",
    },
    {
      label: "Connected Accounts",
      value: stats.connectedAccounts,
      icon: Share2Icon,
      trend: "Active",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome bar */}
      <div>
        <h2 className="text-2xl text-slate-900">Good morning! 👋</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Here's what's happening with your social accounts today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white hover:bg-red-50 relative border border-slate-200 rounded-2xl p-5 hover:border-red-200 transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-3xl font-semibold text-slate-900">
                {card.value}
              </div>
              <div className="text-xs absolute right-4 top-4 text-red-500 flex items-center gap-1">
                <TrendingUpIcon className="size-3" />
                {card.trend}
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-slate-900">Recent Activity</h2>
          <span className="text-sm text-slate-400">
            {activities.length} events
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="size-12 bg-slate-100 rounded-xl flex items-center justify-center mb-3">
              <ActivityIcon className="size-6 text-slate-400" />
            </div>
            <p className="text-slate-500">No activity yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Connect accounts and schedule posts to see events here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activities.map((activity) => (
              <div
                key={activity._id}
                className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-zinc-100 text-zinc-600">
                  <SendIcon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-slate-700">
                      {activity.type || "Published"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(activity.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {activity.description ||
                      activity.content ||
                      "Activity logged"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
