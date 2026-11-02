styles {
    element "Element" {
        color #ffffff
        background #245577
    }
    element "Person" {
        shape Person
        background #17374d
    }
    element "External" {
        background #606b75
    }
    element "Container" {
        background #286b8f
    }
    element "Component" {
        background #e4eff5
        color #17374d
    }
    element "Database" {
        shape Cylinder
    }
    element "Local Storage" {
        shape Cylinder
    }
    element "Shared Code" {
        background #e3eedb
        color #25401d
    }
    relationship "Relationship" {
        color #606b75
        routing Orthogonal
    }
}
