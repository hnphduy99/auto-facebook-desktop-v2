import { v4 as uuidv4 } from "uuid";
import { decrypt, encrypt } from "./encryption.service";
import { store } from "./store";

export interface Account {
  id: string;
  email: string;
  password: string; // Stored encrypted; decrypted on read
  name?: string;
  status: "active" | "inactive" | "error";
  lastLogin?: string;
  cookiesPath?: string;
  createdAt: string;
}

export class AccountService {
  /** Returns all accounts with passwords decrypted. */
  getAll(): Account[] {
    const accounts = (store.get("accounts") as Account[]) || [];
    return accounts.map((a) => ({
      ...a,
      password: decrypt(a.password)
    }));
  }

  getById(id: string): Account | undefined {
    return this.getAll().find((a) => a.id === id);
  }

  add(data: Omit<Account, "id" | "createdAt" | "status">): Account {
    const accounts = (store.get("accounts") as Account[]) || [];
    const account: Account = {
      ...data,
      id: uuidv4(),
      password: encrypt(data.password), // Encrypt before storing
      status: "inactive",
      createdAt: new Date().toISOString()
    };
    accounts.push(account);
    store.set("accounts", accounts);
    // Return with decrypted password for UI
    return { ...account, password: data.password };
  }

  update(id: string, updates: Partial<Account>): Account {
    const accounts = (store.get("accounts") as Account[]) || [];
    const index = accounts.findIndex((a) => a.id === id);
    if (index === -1) throw new Error("Account not found");

    // Encrypt password if it's being updated
    if (updates.password) {
      updates = { ...updates, password: encrypt(updates.password) };
    }

    accounts[index] = { ...accounts[index], ...updates };
    store.set("accounts", accounts);

    // Return with decrypted password
    return { ...accounts[index], password: decrypt(accounts[index].password) };
  }

  delete(id: string): void {
    const accounts = (store.get("accounts") as Account[]).filter((a) => a.id !== id);
    store.set("accounts", accounts);
  }
}

export const accountService = new AccountService();
