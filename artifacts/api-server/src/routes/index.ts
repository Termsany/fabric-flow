import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "../modules/auth/auth.routes";
import usersRouter from "./users";
import productionOrdersRouter from "./production-orders";
import fabricRollsRouter from "./fabric-rolls";
import qcReportsRouter from "./qc-reports";
import dyeingOrdersRouter from "./dyeing-orders";
import warehousesRouter from "../modules/warehouses/warehouses.routes";
import salesRouter from "../modules/sales/sales.routes";
import dashboardRouter from "./dashboard";
import billingRouter from "./billing";
import adminTenantsRouter from "./admin-tenants";
import settingsPaymentMethodsRouter from "./settings-payment-methods";
import plansRouter from "../modules/plans/plans.routes";
import operationalSearchRouter from "../modules/search/operational-search.routes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(productionOrdersRouter);
router.use(fabricRollsRouter);
router.use(qcReportsRouter);
router.use(dyeingOrdersRouter);
router.use(warehousesRouter);
router.use(salesRouter);
router.use(operationalSearchRouter);
router.use(dashboardRouter);
router.use(billingRouter);
router.use(plansRouter);
router.use(settingsPaymentMethodsRouter);
router.use(adminTenantsRouter);

export default router;
