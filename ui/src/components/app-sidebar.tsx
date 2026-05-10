import { useEffect, useState } from "react"
import {
  ChevronDown,
  Cpu,
  Globe,
  HardDrive,
  LayoutDashboard,
  Boxes,
  Network,
  Server,
  Terminal,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const getContext = () => localStorage.getItem("kube-context") || ""
const setContext = (ctx: string) => localStorage.setItem("kube-context", ctx)

const navItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Kubernetes", path: "/kubernetes", icon: Boxes },
  { name: "KubeVirt", path: "/kubevirt", icon: Cpu },
  { name: "Storage", path: "/storage", icon: HardDrive },
  { name: "Nodes", path: "/nodes", icon: Server },
  { name: "Networks", path: "/networks", icon: Network },
]

export function AppSidebar() {
  const location = useLocation()
  const [contexts, setContexts] = useState<string[]>([])
  const [currentCtx, setCurrentCtx] = useState(getContext())

  useEffect(() => {
    fetch("/api/v1/contexts")
      .then((r) => r.json())
      .then((d) => {
        setContexts(d.contexts || [])
        if (!getContext() && d.default) {
          setContext(d.default)
          setCurrentCtx(d.default)
        }
      })
      .catch(() => {})
  }, [])

  const handleContextChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value
    setContext(v)
    setCurrentCtx(v)
    window.location.reload()
  }

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/"
    return location.pathname.startsWith(path)
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/">
                <div className="flex items-center gap-2">
                  <div className="bg-sidebar-primary p-1.5 rounded-lg shadow-sm">
                    <Terminal className="text-sidebar-primary-foreground h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                      Virt
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground leading-none">
                      Dashboard
                    </span>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.path)}
                    className="transition-all duration-200 hover:bg-accent/60 active:scale-95 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-sm"
                  >
                    <Link to={item.path}>
                      <item.icon className="text-sidebar-primary" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="relative rounded-lg border bg-card p-2 shadow-sm transition-colors hover:bg-muted/50">
          <div className="mb-1 flex items-center gap-2 px-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">Cluster</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <select
            value={currentCtx}
            onChange={handleContextChange}
            className="h-8 w-full cursor-pointer appearance-none rounded-md border bg-background pl-8 pr-7 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {contexts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {contexts.length === 0 && <option value="">Loading...</option>}
          </select>
          <Globe className="pointer-events-none absolute bottom-4 left-4 h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
