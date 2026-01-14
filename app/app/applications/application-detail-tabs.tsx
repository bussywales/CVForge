"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TabBadges, APPLICATION_DETAIL_TABS, ApplicationDetailTabKey, getTabStorageKey, parseTab } from "@/lib/ui/tabs";

type ApplicationDetailTabsProps = {
  applicationId: string;
  defaultTab: ApplicationDetailTabKey;
  hasTabParam: boolean;
  createdParam?: string | null;
  badges: TabBadges;
};

const buildHref = (
  pathname: string,
  tab: ApplicationDetailTabKey,
  createdParam?: string | null
) => {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (createdParam) {
    params.set("created", createdParam);
  }
  return `${pathname}?${params.toString()}`;
};

export default function ApplicationDetailTabs({
  applicationId,
  defaultTab,
  hasTabParam,
  createdParam,
  badges,
}: ApplicationDetailTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [activeTab, setActiveTab] = useState<ApplicationDetailTabKey>(defaultTab);

  useEffect(() => {
    const tabParam = params?.get("tab");
    if (tabParam) {
      const resolved = parseTab(tabParam);
      if (resolved !== activeTab) {
        setActiveTab(resolved);
      }
    }
  }, [params, activeTab]);

  useEffect(() => {
    if (hasTabParam || typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(getTabStorageKey(applicationId));
    if (stored) {
      const resolved = parseTab(stored);
      if (resolved !== activeTab) {
        const href = buildHref(pathname, resolved, createdParam);
        router.replace(href);
        setActiveTab(resolved);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, hasTabParam, pathname, createdParam]);

  const handleTabClick = (tabKey: ApplicationDetailTabKey) => {
    if (tabKey === activeTab) {
      return;
    }
    const href = buildHref(pathname, tabKey, createdParam);
    window.localStorage.setItem(getTabStorageKey(applicationId), tabKey);
    setActiveTab(tabKey);
    router.replace(href);
  };

  return (
    <nav className="flex flex-wrap gap-2">
        {APPLICATION_DETAIL_TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const badge = (() => {
            switch (tab.key) {
              case "apply":
                return badges.apply;
              case "evidence":
                return badges.evidence;
              case "interview":
                return badges.interview;
              case "activity":
                return badges.activity;
              default:
                return null;
            }
          })();
        return (
          <button
            key={tab.key}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => handleTabClick(tab.key)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-[rgb(var(--ink))] text-white"
                : "border border-black/10 bg-white/70 text-[rgb(var(--ink))] hover:border-black/20"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>{tab.label}</span>
              {badge ? (
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--ink))]">
                  {badge === "due" ? "Due" : badge}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
