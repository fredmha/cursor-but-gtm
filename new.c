#include <stdio.h>
#include <stdlib.h>


int data[5] = {1, 2, 3, 4, 5};


struct node{ 
    int data;
    struct node *left;
    struct node *right;
    int height;
};


struct node *createnode(int data) {
    struct node *newnode = (struct node *)malloc(sizeof(struct node));
    newnode->data = data;
    newnode->left = NULL;
    newnode->right = NULL;
    return newnode;
};


struct node *insert(struct node *root, int data) {
    if (root == NULL) {
        return createnode(data);
    }
    if (data < root->data) {
        root->left = insert(root->left, data);
    }
    else {
        root->right = insert(root->right, data);
    }
    return root;
};


//problem - given    the array that is sorted, create teh balanced bst

int getheight(struct node *root) { 
    if (root == NULL) { return 0; }
    return root->height;
}

int max(int a, int b) {
    if (a > b) { return a; }
    return b;
}

int updateheight(struct node *root) {
    int leftHeight = getheight(root->left);
    int rightHeight = getheight(root->right);
    root->height = max(leftHeight, rightHeight) + 1;
    return root->height;
}

int balancingfactor(struct node *root) {
    if (root == NULL) { 
        return 0;
    }

    int leftheight = getheight(root->left);
    int rightheight = getheight(root->right);
    int balancefactor = leftheight - rightheight;
    return balancefactor;
}


struct node *leftrotation(struct node *root) {
   struct node *newnode = root->right;
   struct node *newsubtree = newnode->left;

   newnode->left = root;
   root->right = newsubtree;

   return newnode;
}

struct node *rightrotation(struct node *root)  {
    struct node *newnode = root->left;
    struct node *newsubtree = newnode->right;

    newnode->right = root;
    root->left = newsubtree;

    return newnode;
};

struct node *rightleftrotation(struct node *root) { 
    root->right = rightrotation(root->right);
    return leftrotation(root);
};

struct node *leftrightrotation(struct node *root) { 
    root->left = leftrotation(root->left);
    return rightrotation(root);
};

struct node *balance(struct node *root) {
    int balancefactor = balancingfactor(root);
    updateheight(root);
    if (balancefactor > 1) {
        if (balancingfactor(root->left) < 0) {
            return leftrightrotation(root);
        }
        else {
            return rightrotation(root);
        }
    }
    if (balancefactor < -1) {
        if (balancingfactor(root->right) > 0) {
            return rightleftrotation(root);
        }

        return leftrotation(root);
    }

    return root;
};

void inorder(struct node *root) {
    if (root == NULL) {
        return;
    }
    inorder(root->left);
    printf("%d ", root->data);
    inorder(root->right);
}

int main() {
    struct node *root = createnode(data[0]);
    for (int i = 1; i < 5; i++) {
        root = insert(root, data[i]);
        root = balance(root);
    }
    

    printf("Inorder traversal of the balanced BST: ");
    inorder(root);
    printf("\n");
    return 0;
}
