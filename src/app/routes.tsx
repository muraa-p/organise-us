import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Home } from "./components/Home";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { Dashboard } from "./components/Dashboard";
import { CreateGroup } from "./components/CreateGroup";
import { GroupDetail } from "./components/GroupDetail";
import { JoinGroup } from "./components/JoinGroup";
import { Pricing } from "./components/Pricing";
import { NotFound } from "./components/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "login", Component: Login },
      { path: "signup", Component: Signup },
      { path: "dashboard", Component: Dashboard },
      { path: "create-group", Component: CreateGroup },
      { path: "groups/:groupId", Component: GroupDetail },
      { path: "join/:userId/:groupId", Component: JoinGroup },
      { path: "pricing", Component: Pricing },
      { path: "*", Component: NotFound },
    ],
  },
]);
