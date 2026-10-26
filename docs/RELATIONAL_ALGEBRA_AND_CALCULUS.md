# JM-DH Banking System — Relational Algebra & Relational Calculus Guide

**Course Level**: Advanced DBMS Query Theory & Mathematical Foundations  
**Target Engine**: MySQL 8.0+  
**Focus**: Formal Query Theory, Operational Relational Algebra, Declarative TRC & DRC, Codd's Completeness Theorem  

---

## 1. Theoretical Foundations & Classification

Relational query languages are classified into two major paradigms:
1. **Procedural (Operational) — Relational Algebra**: Specifies *how* to evaluate the query through a series of relational algebraic operators applied to relations to yield a new relation.
2. **Declarative (Non-Procedural) — Relational Calculus**: Specifies *what* information is desired without prescribing the algorithmic retrieval plan.
   - **Tuple Relational Calculus (TRC)**: Queries range over tuple variables $\{ t \mid P(t) \}$.
   - **Domain Relational Calculus (DRC)**: Queries range over domain variables corresponding to attribute values $\{ \langle x_1, x_2, \dots \rangle \mid P(x_1, x_2, \dots) \}$.

> **Codd's Theorem**: Relational Algebra, safe Tuple Relational Calculus, and safe Domain Relational Calculus are equivalent in expressive power. A query language that can express all relational algebra queries is called **relationally complete**. SQL is a concrete, declarative realization of relational calculus with algebraic evaluation under the query optimizer.

---

## 2. Mapping Relational Operations to Production SQL

Below is the formal mapping of 10 fundamental relational operations to the JM-DH Banking System schema.

### Operation 1: Selection ($\sigma$)
- **Formal Definition**: $\sigma_p(R) = \{ t \in R \mid p(t) = \text{TRUE} \}$
- **Business Question**: Find all customers in the 'Platinum' or 'VIP' tier with a CIBIL credit score $\ge 780$.
- **Relational Algebra Expression**:
  $$\sigma_{(\text{tier} \in \{\text{'Platinum'}, \text{'VIP'}\}) \land (\text{credit\_score} \ge 780)}(\text{CUSTOMERS})$$
- **SQL Implementation**:
  ```sql
  SELECT customer_id, full_name, email, tier, credit_score
  FROM customers
  WHERE tier IN ('Platinum', 'VIP') AND credit_score >= 780;
  ```
- **Explanation**: Filters horizontal tuples from `CUSTOMERS` satisfying the predicate, preserving all degree attributes while reducing cardinality.

---

### Operation 2: Projection ($\pi$)
- **Formal Definition**: $\pi_{A_1, A_2, \dots, A_k}(R) = \{ t[A_1, A_2, \dots, A_k] \mid t \in R \}$
- **Business Question**: Retrieve the catalog of distinct bank branches and their operating cities.
- **Relational Algebra Expression**:
  $$\pi_{\text{branch\_name}, \text{city}, \text{ifsc\_code}}(\text{BRANCHES})$$
- **SQL Implementation**:
  ```sql
  SELECT DISTINCT branch_name, city, ifsc_code
  FROM branches;
  ```
- **Explanation**: Extracts vertical columns and removes duplicate rows according to set semantics.

---

### Operation 3: Natural / Equi-Join ($\bowtie$)
- **Formal Definition**: $R \bowtie_{R.A = S.A} S = \sigma_{R.A = S.A}(R \times S)$
- **Business Question**: Retrieve each active account along with its customer owner's legal full name.
- **Relational Algebra Expression**:
  $$\pi_{\text{customer\_id}, \text{full\_name}, \text{account\_number}, \text{balance}}(\text{CUSTOMERS} \bowtie_{\text{CUSTOMERS.customer\_id} = \text{ACCOUNTS.customer\_id}} \sigma_{\text{status} = \text{'Active'}}(\text{ACCOUNTS}))$$
- **SQL Implementation**:
  ```sql
  SELECT c.customer_id, c.full_name, a.account_number, a.balance
  FROM customers c
  INNER JOIN accounts a ON c.customer_id = a.customer_id
  WHERE a.status = 'Active';
  ```
- **Explanation**: Combines related tuples across entities on the common primary/foreign key `customer_id`.

---

### Operation 4: Theta-Join ($\bowtie_\theta$)
- **Formal Definition**: $R \bowtie_\theta S = \sigma_\theta(R \times S)$, where $\theta$ is any relational comparison condition ($=, <, >, \le, \ge, \neq$).
- **Business Question**: Match high-net-worth customers with instant credit eligibility where liquid balance exceeds 1,00,000 and credit score $\ge 750$.
- **Relational Algebra Expression**:
  $$\text{CUSTOMERS} \bowtie_{(\text{ACCOUNTS.balance} > 100000) \land (\text{CUSTOMERS.credit\_score} \ge 750)} \text{ACCOUNTS}$$
- **SQL Implementation**:
  ```sql
  SELECT 
      c.customer_id, c.full_name, c.credit_score,
      a.account_number, a.balance,
      ROUND(a.balance * 0.30, 2) AS eligible_instant_credit_limit
  FROM customers c
  INNER JOIN accounts a ON c.customer_id = a.customer_id
  WHERE a.balance > 100000.00 AND c.credit_score >= 750;
  ```
- **Explanation**: Joins tuples on non-key theta inequality predicates evaluating credit risk policy.

---

### Operation 5: Set Union ($\cup$)
- **Formal Definition**: $R \cup S = \{ t \mid t \in R \lor t \in S \}$ (Requires union-compatibility).
- **Business Question**: Retrieve all unique account numbers that have participated in any financial transaction (either debited as sender or credited as receiver).
- **Relational Algebra Expression**:
  $$\pi_{\text{sender\_account}}(\sigma_{\text{sender\_account} \neq \text{NULL}}(\text{TRANSACTIONS})) \cup \pi_{\text{receiver\_account}}(\sigma_{\text{receiver\_account} \neq \text{NULL}}(\text{TRANSACTIONS}))$$
- **SQL Implementation**:
  ```sql
  SELECT sender_account AS active_account FROM transactions WHERE sender_account IS NOT NULL
  UNION
  SELECT receiver_account AS active_account FROM transactions WHERE receiver_account IS NOT NULL;
  ```
- **Explanation**: Merges tuples from both projections and eliminates duplicates.

---

### Operation 6: Set Difference ($-$)
- **Formal Definition**: $R - S = \{ t \mid t \in R \land t \notin S \}$
- **Business Question**: Find all active registered customers who have never booked a term deposit.
- **Relational Algebra Expression**:
  $$\pi_{\text{customer\_id}}(\text{CUSTOMERS}) - \pi_{\text{customer\_id}}(\text{DEPOSITS})$$
- **SQL Implementation (MySQL 8.0 `EXCEPT`)**:
  ```sql
  SELECT customer_id FROM customers
  EXCEPT
  SELECT customer_id FROM deposits;
  ```
- **Explanation**: Returns tuples present in the customer relation that have no matching customer ID in the term deposits relation.

---

### Operation 7: Set Intersection ($\cap$)
- **Formal Definition**: $R \cap S = \{ t \mid t \in R \land t \in S \} = R - (R - S)$
- **Business Question**: Find customer IDs of customers who simultaneously hold an active Savings Account and an active Current Account.
- **Relational Algebra Expression**:
  $$\pi_{\text{customer\_id}}(\sigma_{\text{account\_type} = \text{'Savings Account'}}(\text{ACCOUNTS})) \cap \pi_{\text{customer\_id}}(\sigma_{\text{account\_type} = \text{'Current Account'}}(\text{ACCOUNTS}))$$
- **SQL Implementation (MySQL 8.0 `INTERSECT`)**:
  ```sql
  SELECT customer_id FROM accounts WHERE account_type = 'Savings Account'
  INTERSECT
  SELECT customer_id FROM accounts WHERE account_type = 'Current Account';
  ```
- **Explanation**: Identifies elements common to both relational sets.

---

### Operation 8: Cartesian Product ($\times$)
- **Formal Definition**: $R \times S = \{ t_1 \circ t_2 \mid t_1 \in R \land t_2 \in S \}$
- **Business Question**: Compute all theoretical combinations of customer tiers and product deposit tenures for marketing pricing matrices.
- **Relational Algebra Expression**:
  $$\pi_{\text{tier}}(\text{CUSTOMERS}) \times \pi_{\text{tenure\_months}}(\text{DEPOSITS})$$
- **SQL Implementation**:
  ```sql
  SELECT DISTINCT c.tier, d.tenure_months
  FROM customers c
  CROSS JOIN deposits d
  ORDER BY c.tier, d.tenure_months;
  ```
- **Explanation**: Generates every possible pairing between tuples of the two relations, resulting in $|R| \times |S|$ rows.

---

### Operation 9: Relational Division ($\div$)
- **Formal Definition**: Given $R(A, B)$ and $S(B)$, $R \div S = \{ t \in \pi_A(R) \mid \forall s \in S, (t, s) \in R \}$.
- **Business Question**: Find all customers who hold accounts in **every** branch located in the city of 'Mumbai'.
- **Relational Algebra Expression**:
  $$\text{Let } R = \pi_{\text{customer\_id}, \text{ifsc\_code}}(\text{ACCOUNTS})$$
  $$\text{Let } S = \pi_{\text{ifsc\_code}}(\sigma_{\text{city} = \text{'Mumbai'}}(\text{BRANCHES}))$$
  $$\text{Result} = R \div S$$
- **SQL Implementation (Universal Quantification via Double `NOT EXISTS`)**:
  ```sql
  SELECT c.customer_id, c.full_name
  FROM customers c
  WHERE NOT EXISTS (
      -- S: All branches located in Mumbai
      SELECT b.ifsc_code 
      FROM branches b 
      WHERE b.city = 'Mumbai'
        AND NOT EXISTS (
            -- Pairs in R matching customer c and branch b
            SELECT 1 
            FROM accounts a 
            WHERE a.customer_id = c.customer_id 
              AND a.ifsc_code = b.ifsc_code
        )
  );
  ```
- **Explanation**: Implements universal quantification ($\forall x \in S, P(x) \equiv \neg \exists x \in S \text{ such that } \neg P(x)$).

---

## 3. Tuple Relational Calculus (TRC)

### 3.1 Formal TRC Syntax:
$$\{ t \mid P(t) \}$$
Where $t$ is a tuple variable and $P(t)$ is a first-order formula built from atoms, logical connectives ($\land, \lor, \neg$), and quantifiers ($\exists, \forall$).

### 3.2 TRC Example (High-Value Customers):
*Find all customer tuples whose credit score exceeds 800:*
$$\{ c \mid c \in \text{CUSTOMERS} \land c[\text{credit\_score}] > 800 \}$$

### 3.3 TRC Example with Existential Quantifier (Join):
*Find full names of customers who hold an active account with balance $\ge 1,00,000$:*
$$\{ t[\text{full\_name}] \mid \exists c \in \text{CUSTOMERS}, \exists a \in \text{ACCOUNTS} \, (c[\text{customer\_id}] = a[\text{customer\_id}] \land a[\text{balance}] \ge 100000 \land t[\text{full\_name}] = c[\text{full\_name}]) \}$$

---

## 4. Domain Relational Calculus (DRC)

### 4.1 Formal DRC Syntax:
$$\{ \langle x_1, x_2, \dots, x_n \rangle \mid P(x_1, x_2, \dots, x_n) \}$$
Where each $x_i$ represents a domain variable over an individual attribute domain.

### 4.2 DRC Example:
*Find the customer ID and full name of all customers residing in Mumbai:*
$$\{ \langle \text{id}, \text{name} \rangle \mid \exists \text{email}, \exists \text{phone}, \exists \text{dob}, \exists \text{addr}, \dots \, (\langle \text{id}, \text{name}, \text{email}, \text{phone}, \text{dob}, \text{addr}, \dots \rangle \in \text{CUSTOMERS} \land \text{addr LIKE '\%Mumbai\%'}) \}$$

---

## 5. Safe Expressions & The Domain Restriction Rule

A relational calculus expression $\{ t \mid P(t) \}$ is called **unsafe** if it can generate an infinite number of tuples not belonging to the database domain.
- *Unsafe Example*: $\{ t \mid \neg(t \in \text{CUSTOMERS}) \}$ (Attempts to return all tuples in the universe that are not customers).
- *Safety Guarantee*: All variables must be bound to the **active domain** of the database ($\text{dom}(P, r)$). Both SQL and relational algebra query optimizers restrict evaluation strictly to safe domains.
