class PermissionConstants:
    """
    Centralized permission constants for consistent naming and management
    """
    # User Management Permissions
    USER_VIEW_ALL = 'user.view_all'
    USER_CREATE = 'user.create'
    USER_EDIT = 'user.edit'
    USER_DELETE = 'user.delete'

    # Order Permissions
    ORDER_VIEW = 'core.view_order'
    ORDER_CREATE = 'core.create_order'
    ORDER_EDIT = 'core.edit_order'
    ORDER_DELETE = 'core.delete_order'
    ORDER_STATUS_UPDATE = 'core.update_order_status'
    ORDER_ASSIGN = 'core.assign_order'

    # Product Permissions
    PRODUCT_VIEW = 'products.view_product'
    PRODUCT_CREATE = 'products.create_product'
    PRODUCT_EDIT = 'products.edit_product'
    PRODUCT_DELETE = 'products.delete_product'

    # Invoice Permissions
    INVOICE_VIEW = 'invoices.view_invoice'
    INVOICE_CREATE = 'invoices.create_invoice'
    INVOICE_EDIT = 'invoices.edit_invoice'
    INVOICE_DELETE = 'invoices.delete_invoice'

    # Transaction Permissions
    TRANSACTION_VIEW = 'transactions.view_transaction'
    TRANSACTION_CREATE = 'transactions.create_transaction'
    TRANSACTION_EDIT = 'transactions.edit_transaction'
    TRANSACTION_DELETE = 'transactions.delete_transaction'

    # Stock Adjustment Permissions
    STOCK_ADJUSTMENT_VIEW = 'stock_adjustments.view_adjustment'
    STOCK_ADJUSTMENT_CREATE = 'stock_adjustments.create_adjustment'
    STOCK_ADJUSTMENT_EDIT = 'stock_adjustments.edit_adjustment'
    STOCK_ADJUSTMENT_DELETE = 'stock_adjustments.delete_adjustment'

    # Report Permissions
    REPORT_VIEW = 'reports.view_report'
    REPORT_CREATE = 'reports.create_report'
    REPORT_EDIT = 'reports.edit_report'
    REPORT_DELETE = 'reports.delete_report'

    RECEIPT_VIEW = 'receipt_view'
    RECEIPT_CREATE = 'receipt_create'
    RECEIPT_EDIT = 'receipt_edit'
    RECEIPT_DELETE = 'receipt_delete'

    # System Permissions
    SYSTEM_FULL_ACCESS = 'system.full_access'
    SYSTEM_ANALYTICS_ACCESS = 'system.analytics_access'
