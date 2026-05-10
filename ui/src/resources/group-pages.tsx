import { Link, useParams } from "react-router-dom";
import { Cpu, HardDrive, Network } from "lucide-react";

import type { ResourceConfig } from "@/components/resource-management";
import { Badge } from "@/components/ui/badge";
import { Card as ShadCard, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dvCreateConfig, resourceConfigs, vmCreateConfig } from "./configs";

type KubeVirtResourceGroup = {
  slug: string;
  title: string;
  description: string;
  resources: ResourceConfig[];
};

const kubevirtResourceGroups: KubeVirtResourceGroup[] = [
  {
    slug: "virtualization",
    title: "Virtualization",
    description: "VirtualMachine, live VMI, pools, replica sets, and KubeVirt installation resources.",
    resources: [
      vmCreateConfig,
      resourceConfigs.virtualmachineinstances,
      resourceConfigs.virtualmachinepools,
      resourceConfigs.virtualmachineinstancereplicasets,
      resourceConfigs.kubevirts,
    ],
  },
  {
    slug: "cdi",
    title: "CDI Storage",
    description: "DataVolume, DataSource, StorageProfile, import, upload, clone, and transfer resources.",
    resources: [
      dvCreateConfig,
      resourceConfigs.datasources,
      resourceConfigs.storageprofiles,
      resourceConfigs.dataimportcrons,
      resourceConfigs.volumeimportsources,
      resourceConfigs.volumeuploadsources,
      resourceConfigs.volumeclonesources,
      resourceConfigs.objecttransfers,
    ],
  },
  {
    slug: "templates",
    title: "Templates",
    description: "KubeVirt instance type and preference resources.",
    resources: [
      resourceConfigs.virtualmachineclusterinstancetypes,
      resourceConfigs.virtualmachineclusterpreferences,
      resourceConfigs.virtualmachineinstancetypes,
      resourceConfigs.virtualmachinepreferences,
    ],
  },
  {
    slug: "snapshots",
    title: "Snapshots",
    description: "VirtualMachine snapshot, restore, and snapshot content resources.",
    resources: [
      resourceConfigs.virtualmachinesnapshots,
      resourceConfigs.virtualmachinerestores,
      resourceConfigs.virtualmachinesnapshotcontents,
    ],
  },
  {
    slug: "operations",
    title: "Operations",
    description: "Migration, autoscaling, SSH key, and operational KubeVirt resources.",
    resources: [
      resourceConfigs.virtualmachineinstancemigrations,
      resourceConfigs.horizontalpodautoscalers,
      resourceConfigs.secrets,
    ],
  },
];

export function KubeVirtManagementPage() {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">KubeVirt</h1>
        <p className="text-sm text-muted-foreground">Choose a KubeVirt or CDI resource family before managing concrete CRDs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kubevirtResourceGroups.map((group) => (
          <Link key={group.slug} to={`/kubevirt/${group.slug}`} className="block">
            <ShadCard className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{group.title}</CardTitle>
                  </div>
                  <Badge variant="outline">{group.resources.length}</Badge>
                </div>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
            </ShadCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function KubeVirtCategoryPage() {
  const { category } = useParams();
  const group = kubevirtResourceGroups.find((item) => item.slug === category);

  if (!group) {
    return <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-12">KubeVirt category not found</div>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/kubevirt" className="hover:text-primary">KubeVirt</Link>
          <span>/</span>
          <span>{group.title}</span>
        </div>
        <h1 className="text-2xl font-bold">{group.title}</h1>
        <p className="text-sm text-muted-foreground">{group.description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.resources.map((config) => (
          <Link key={config.path} to={config.path} className="block">
            <ShadCard className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{config.title}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{config.subtitle}</CardDescription>
                  </div>
                  <Badge variant="outline">{config.namespaced ? "Namespaced" : "Cluster"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">{config.kind}</div>
              </CardContent>
            </ShadCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

type NetworkResourceGroup = {
  slug: string;
  title: string;
  description: string;
  resources: ResourceConfig[];
};

type StorageResourceGroup = {
  slug: string;
  title: string;
  description: string;
  resources: ResourceConfig[];
};

const storageResourceGroups: StorageResourceGroup[] = [
  {
    slug: "kubernetes",
    title: "Kubernetes",
    description: "Native StorageClass, PersistentVolume, and PersistentVolumeClaim resources.",
    resources: [
      resourceConfigs.storageclasses,
      resourceConfigs.persistentvolumes,
      resourceConfigs.persistentvolumeclaims,
      resourceConfigs.csidrivers,
      resourceConfigs.csinodes,
      resourceConfigs.csistoragecapacities,
      resourceConfigs.volumeattachments,
      resourceConfigs.volumeattributesclasses,
      resourceConfigs.volumesnapshotclasses,
      resourceConfigs.volumesnapshots,
      resourceConfigs.volumesnapshotcontents,
    ],
  },
];

export function StorageManagementPage() {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Storage</h1>
        <p className="text-sm text-muted-foreground">Choose a Kubernetes storage API group before managing concrete resources.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {storageResourceGroups.map((group) => (
          <Link key={group.slug} to={`/storage/${group.slug}`} className="block">
            <ShadCard className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{group.title}</CardTitle>
                  </div>
                  <Badge variant="outline">{group.resources.length}</Badge>
                </div>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
            </ShadCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function StorageCategoryPage() {
  const { category } = useParams();
  const group = storageResourceGroups.find((item) => item.slug === category);

  if (!group) {
    return <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-12">Storage category not found</div>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/storage" className="hover:text-primary">Storage</Link>
            <span>/</span>
            <span>{group.title}</span>
          </div>
          <h1 className="text-2xl font-bold">{group.title}</h1>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.resources.map((config) => (
          <Link key={config.path} to={config.path} className="block">
            <ShadCard className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{config.title}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{config.subtitle}</CardDescription>
                  </div>
                  <Badge variant="outline">{config.namespaced ? "Namespaced" : "Cluster"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">{config.kind}</div>
              </CardContent>
            </ShadCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

const networkResourceGroups: NetworkResourceGroup[] = [
  {
    slug: "kubernetes",
    title: "Kubernetes",
    description: "Core Service, Endpoint, Ingress, NetworkPolicy, IngressClass, and Multus resources.",
    resources: [
      resourceConfigs.kubernetesServices,
      resourceConfigs.endpoints,
      resourceConfigs.endpointSlices,
      resourceConfigs["network-attachment-definitions"],
      resourceConfigs.networkpolicies,
      resourceConfigs.ingresses,
      resourceConfigs.ingressClasses,
    ],
  },
  {
    slug: "gateway-api",
    title: "Gateway API",
    description: "GatewayClass, Gateway, and HTTPRoute routing resources.",
    resources: [
      resourceConfigs.gatewayclasses,
      resourceConfigs.gateways,
      resourceConfigs.httproutes,
    ],
  },
  {
    slug: "calico",
    title: "Calico",
    description: "Calico policy, BGP, IPAM, host endpoint, tier, and controller resources.",
    resources: [
      resourceConfigs.calicoNetworkPolicies,
      resourceConfigs.calicoGlobalNetworkPolicies,
      resourceConfigs.calicoIPPools,
      resourceConfigs.calicoTiers,
      resourceConfigs.calicoNetworkSets,
      resourceConfigs.calicoGlobalNetworkSets,
      resourceConfigs.calicoStagedNetworkPolicies,
      resourceConfigs.calicoStagedGlobalNetworkPolicies,
      resourceConfigs.calicoStagedKubernetesNetworkPolicies,
      resourceConfigs.calicoHostEndpoints,
      resourceConfigs.calicoBGPConfigurations,
      resourceConfigs.calicoBGPPeers,
      resourceConfigs.calicoBGPFilters,
      resourceConfigs.calicoFelixConfigurations,
      resourceConfigs.calicoKubeControllersConfigurations,
      resourceConfigs.calicoIPReservations,
      resourceConfigs.calicoBlockAffinities,
      resourceConfigs.calicoCalicoNodeStatuses,
      resourceConfigs.calicoClusterInformations,
      resourceConfigs.calicoIPAMBlocks,
      resourceConfigs.calicoIPAMConfigs,
      resourceConfigs.calicoIPAMHandles,
    ],
  },
  {
    slug: "cilium",
    title: "Cilium",
    description: "Cilium policy, endpoint, BGP, Envoy, IP pool, egress, L2, and Gateway resources.",
    resources: [
      resourceConfigs.ciliumNetworkPolicies,
      resourceConfigs.ciliumClusterwideNetworkPolicies,
      resourceConfigs.ciliumNodes,
      resourceConfigs.ciliumEndpoints,
      resourceConfigs.ciliumEndpointSlices,
      resourceConfigs.ciliumIdentities,
      resourceConfigs.ciliumEnvoyConfigs,
      resourceConfigs.ciliumClusterwideEnvoyConfigs,
      resourceConfigs.ciliumCIDRGroups,
      resourceConfigs.ciliumEgressGatewayPolicies,
      resourceConfigs.ciliumLoadBalancerIPPools,
      resourceConfigs.ciliumLocalRedirectPolicies,
      resourceConfigs.ciliumL2AnnouncementPolicies,
      resourceConfigs.ciliumPodIPPools,
      resourceConfigs.ciliumGatewayClassConfigs,
      resourceConfigs.ciliumNodeConfigs,
      resourceConfigs.ciliumDatapathPlugins,
      resourceConfigs.ciliumBGPAdvertisements,
      resourceConfigs.ciliumBGPClusterConfigs,
      resourceConfigs.ciliumBGPNodeConfigs,
      resourceConfigs.ciliumBGPNodeConfigOverrides,
      resourceConfigs.ciliumBGPPeerConfigs,
    ],
  },
  {
    slug: "kube-ovn",
    title: "Kube-OVN",
    description: "Kube-OVN subnet, VPC, NAT, egress, IP, policy, and provider network resources.",
    resources: [
      resourceConfigs.kubeOvnSubnets,
      resourceConfigs.kubeOvnVpcs,
      resourceConfigs.kubeOvnProviderNetworks,
      resourceConfigs.kubeOvnVlans,
      resourceConfigs.kubeOvnIPPools,
      resourceConfigs.kubeOvnIPs,
      resourceConfigs.kubeOvnVpcNatGateways,
      resourceConfigs.kubeOvnIptablesEIPs,
      resourceConfigs.kubeOvnIptablesDnatRules,
      resourceConfigs.kubeOvnIptablesSnatRules,
      resourceConfigs.kubeOvnIptablesFIPRules,
      resourceConfigs.kubeOvnOvnEips,
      resourceConfigs.kubeOvnOvnDnatRules,
      resourceConfigs.kubeOvnOvnSnatRules,
      resourceConfigs.kubeOvnOvnFips,
      resourceConfigs.kubeOvnVips,
      resourceConfigs.kubeOvnSwitchLBRules,
      resourceConfigs.kubeOvnVpcDnses,
      resourceConfigs.kubeOvnVpcEgressGateways,
      resourceConfigs.kubeOvnQoSPolicies,
      resourceConfigs.kubeOvnSecurityGroups,
      resourceConfigs.kubeOvnBgpConfs,
      resourceConfigs.kubeOvnEvpnConfs,
      resourceConfigs.kubeOvnDNSNameResolvers,
    ],
  },
];

export function NetworkManagementPage() {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Networks</h1>
        <p className="text-sm text-muted-foreground">Choose a network provider or API group before managing concrete resources.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {networkResourceGroups.map((group) => (
          <Link key={group.slug} to={`/networks/${group.slug}`} className="block">
            <ShadCard className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{group.title}</CardTitle>
                  </div>
                  <Badge variant="outline">{group.resources.length}</Badge>
                </div>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
            </ShadCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function NetworkCategoryPage() {
  const { category } = useParams();
  const group = networkResourceGroups.find((item) => item.slug === category);

  if (!group) {
    return <div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-12">Network category not found</div>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/networks" className="hover:text-primary">Networks</Link>
            <span>/</span>
            <span>{group.title}</span>
          </div>
          <h1 className="text-2xl font-bold">{group.title}</h1>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.resources.map((config) => (
          <Link key={config.path} to={config.path} className="block">
            <ShadCard className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{config.title}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{config.subtitle}</CardDescription>
                  </div>
                  <Badge variant="outline">{config.namespaced ? "Namespaced" : "Cluster"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">{config.kind}</div>
              </CardContent>
            </ShadCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
