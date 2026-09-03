import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ShortcutBadge } from "@/components/keyboardShortcutComponents";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type NavTabDefinition = {
  label: string;
  component: ReactNode;
  shortcutId?: string;
  labelSuffix?: ReactNode;
  visible?: boolean;
};

type NavTabsProps<TabKey extends string> = {
  tabs: Record<TabKey, NavTabDefinition>;
  currentTab?: TabKey;
  onTabChange: (tab: TabKey) => void;
  tabTriggerClassName?: string;
  tabContentClassName?: string;
} & Omit<React.ComponentProps<typeof Tabs>, "value" | "onValueChange">;

export const NavTabs = <TabKey extends string>({
  tabs,
  currentTab,
  onTabChange,
  tabTriggerClassName,
  tabContentClassName,
  ...props
}: NavTabsProps<TabKey>) => {
  const tabKeys = (Object.keys(tabs) as TabKey[]).filter(
    (key) => tabs[key].visible !== false,
  );

  return (
    <Tabs
      {...props}
      value={currentTab ?? tabKeys[0]}
      onValueChange={(tab) => onTabChange(tab as TabKey)}
    >
      <TabsList className="w-full justify-evenly sm:justify-start border-b rounded-none bg-transparent p-0 h-auto overflow-x-auto">
        {tabKeys.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className={cn(
              "border-b-3 px-1.5 sm:px-2.5 py-2 text-gray-600 font-semibold hover:text-gray-900 data-[state=active]:border-b-primary-700 data-[state=active]:text-primary-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none",
              tabTriggerClassName,
            )}
          >
            {tabs[key].label}
            {tabs[key].labelSuffix}
            {tabs[key].shortcutId && (
              <ShortcutBadge actionId={tabs[key].shortcutId} />
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabKeys.map((key) => (
        <TabsContent key={key} value={key} className={tabContentClassName}>
          {tabs[key].component}
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default NavTabs;
