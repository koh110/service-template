#!/bin/sh
set -e

if [ ! -f /etc/envoy/cds.yaml ]; then
  cat > /etc/envoy/cds.yaml <<'EOF'
version_info: "0"
resources:
  - "@type": type.googleapis.com/envoy.config.cluster.v3.Cluster
    name: api_cluster
    type: STRICT_DNS
    dns_lookup_family: V4_ONLY
    load_assignment:
      cluster_name: api_cluster
      endpoints:
        - lb_endpoints:
            - endpoint:
                address:
                  socket_address:
                    address: host.docker.internal
                    port_value: 8080
EOF
fi

exec envoy -c /etc/envoy/envoy.yaml
