import { useEffect, useState } from "react"
import {
  Boxes,
  Camera,
  Cpu,
  Globe,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Image,
  Network,
  Route,
  Scale,
  Server,
  Settings,
  Shield,
  Terminal,
  Undo2,
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
  { name: "Machines", path: "/vms", icon: Cpu },
  { name: "Storage", path: "/dvs", icon: HardDrive },
  { name: "VM Pools", path: "/vmpools", icon: Boxes },
  { name: "Nodes", path: "/nodes", icon: Server },
  { name: "Networks", path: "/networks", icon: Network },
  { name: "Load Balancers", path: "/load-balancers", icon: Route },
  { name: "Instance Types", path: "/instance-types", icon: Cpu },
  { name: "Snapshots", path: "/snapshots", icon: Camera },
  { name: "Restores", path: "/restores", icon: Undo2 },
  { name: "SSH Keys", path: "/ssh-keys", icon: KeyRound },
  { name: "Firewalls", path: "/firewalls", icon: Shield },
  { name: "Autoscaling", path: "/autoscaling", icon: Scale },
  { name: "K8s Clusters", path: "/clusters", icon: Globe },
  { name: "Images", path: "/images", icon: Image },
  { name: "Settings", path: "/settings", icon: Settings },
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
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-gradient-to-r from-muted/40 to-muted/20 border border-border/60">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <select
            value={currentCtx}
            onChange={handleContextChange}
            className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold cursor-pointer text-foreground"
          >
            {contexts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {contexts.length === 0 && <option value="">Loading...</option>}
          </select>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
