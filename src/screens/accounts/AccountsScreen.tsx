import { GradientButton } from "@/components/GradientButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Account, useAppStore } from "@/store";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { CheckCircle, Edit, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as yup from "yup";

const isEmailOrPhone = (value: string) => {
  if (!value) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9+\-\s()]{8,15}$/;
  return emailRegex.test(value) || phoneRegex.test(value);
};

export default function AccountsScreen() {
  const { t, accounts, setAccounts } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const accountSchema = yup.object({
    name: yup.string().default(""),
    email: yup
      .string()
      .required(t.validation.accountRequired)
      .test("email-or-phone", t.validation.accountInvalid, (value) => isEmailOrPhone(value || "")),
    password: yup.string().required(t.validation.passwordRequired).min(6, t.validation.passwordMin)
  });

  type AccountFormData = yup.InferType<typeof accountSchema>;

  const {
    register,
    handleSubmit: hookFormSubmit,
    reset,
    formState: { errors }
  } = useForm<AccountFormData>({
    resolver: yupResolver(accountSchema),
    defaultValues: { name: "", email: "", password: "" }
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    if (!window.api) return;
    try {
      const data = await window.api.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error("[AccountsScreen] Failed to load accounts:", err);
    }
  };

  const onSubmit = async (data: AccountFormData) => {
    if (!window.api) {
      toast.error("Electron API không khả dụng.");
      return;
    }
    setLoading(true);
    try {
      if (editingAccount) {
        await window.api.updateAccount(editingAccount.id, data);
        toast.success("Cập nhật tài khoản thành công!");
      } else {
        await window.api.addAccount(data);
        toast.success("Thêm tài khoản thành công!");
      }
      closeModal();
      await loadAccounts();
    } catch (err: any) {
      toast.error(err?.message || "Có lỗi xảy ra khi lưu tài khoản");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    reset({ email: account.email, password: account.password, name: account.name || "" });
    setShowModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!window.api || !confirmDelete) return;
    await window.api.deleteAccount(confirmDelete);
    setConfirmDelete(null);
    loadAccounts();
    toast.success("Đã xoá tài khoản.");
  };

  const handleCheck = async (id: string) => {
    if (!window.api) return;
    setCheckingId(id);
    try {
      await window.api.checkAccount(id);
      loadAccounts();
      toast.success("Kiểm tra tài khoản hoàn tất!");
    } catch {
      toast.error("Kiểm tra tài khoản thất bại.");
    } finally {
      setCheckingId(null);
    }
  };

  const openAddModal = () => {
    setEditingAccount(null);
    reset({ email: "", password: "", name: "" });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAccount(null);
    reset({ email: "", password: "", name: "" });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return {
          variant: "default" as const,
          label: t.accounts.active,
          className: "bg-green-500/15 text-green-500"
        };
      case "error":
        return { variant: "destructive" as const, label: t.accounts.error, className: "" };
      default:
        return { variant: "secondary" as const, label: t.accounts.inactive, className: "" };
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="gradient-text text-[28px] font-extrabold tracking-tight">{t.accounts.title}</h1>
        <GradientButton onClick={openAddModal} variant="outline">
          <Plus size={16} />
          {t.accounts.addNew}
        </GradientButton>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="bg-secondary mb-5 flex size-18 items-center justify-center rounded-2xl text-3xl">👤</div>
          <p className="text-muted-foreground max-w-100 text-[15px]">{t.accounts.noAccounts}</p>
          <GradientButton className="mt-4" onClick={openAddModal}>
            <Plus size={16} />
            {t.accounts.addNew}
          </GradientButton>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.accounts.name}</TableHead>
              <TableHead>{t.accounts.account}</TableHead>
              <TableHead>{t.accounts.status}</TableHead>
              <TableHead>{t.accounts.lastLogin}</TableHead>
              <TableHead>{t.accounts.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const badge = statusBadge(account.status);
              return (
                <TableRow key={account.id}>
                  <TableCell className="text-foreground font-semibold">{account.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{account.email}</TableCell>
                  <TableCell>
                    <Badge variant={badge.variant} className={badge.className}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {account.lastLogin ? dayjs(account.lastLogin).format("DD/MM/YYYY HH:mm:ss") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-geeen-500/15 border-green-500/20 text-green-500 hover:bg-green-500/25"
                        onClick={() => handleCheck(account.id)}
                        disabled={checkingId === account.id}
                      >
                        {checkingId === account.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={14} />
                        )}
                        {checkingId === account.id ? t.accounts.checking : t.accounts.check}
                      </Button>
                      <Button size="icon" variant="secondary" className="size-8" onClick={() => handleEdit(account)}>
                        <Edit size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="border-destructive/20 bg-destructive/15 text-destructive hover:bg-destructive/25 size-8"
                        onClick={() => setConfirmDelete(account.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.accounts.confirmDelete || "Xoá tài khoản"}</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xoá tài khoản này không? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Xoá tài khoản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={closeModal} disablePointerDismissal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? t.common.edit : t.accounts.addNew}</DialogTitle>
          </DialogHeader>
          <form onSubmit={hookFormSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.accounts.name}</Label>
              <Input {...register("name")} placeholder="Tài khoản chính" />
            </div>
            <div className="space-y-2">
              <Label>{t.accounts.account} *</Label>
              <Input
                {...register("email")}
                placeholder={t.accounts.accountPlaceholder}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t.accounts.password} *</Label>
              <Input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className={errors.password ? "border-destructive" : ""}
              />
              {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal} disabled={loading}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={loading} className="min-w-30">
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t.common.loading}
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    {t.common.save}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
