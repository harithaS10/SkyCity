import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Lock, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  onClick?: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * ExportButton
 * Renders a functional export button for Admin / Super Admin.
 * For Manager and User roles it renders a locked, disabled button with a tooltip.
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  onClick,
  label = 'Export',
  className,
  disabled = false,
  icon,
  variant = 'outline',
  size = 'default',
}) => {
  const { canExport, user } = useAuth();

  if (!canExport) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant={variant}
              size={size}
              className={cn(
                'cursor-not-allowed opacity-50 gap-2',
                className
              )}
              disabled
              aria-label="Export restricted"
            >
              <Lock className="h-4 w-4" />
              {size !== 'icon' && label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px] text-center">
          Export is available for <strong>Admin</strong> accounts only.{' '}
          {user?.role === 'manager'
            ? 'Managers have read-only access.'
            : 'Contact your admin to export data.'}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('gap-2', className)}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ?? <Download className="h-4 w-4" />}
      {size !== 'icon' && label}
    </Button>
  );
};
