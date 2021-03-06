import { Component, OnInit, Input, TemplateRef, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { DtoForSaveKeyBase } from '~/app/data/dto/dto-for-save-key-base';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

@Component({
  selector: 'b-table',
  templateUrl: './table.component.html',
})
export class TableComponent implements OnInit {

  // this is the crown jewel of our framework, a reusable minimum-configuration editable grid
  // with Excel-like editing experience, and virtual scrolling built in so it can handle 100s of
  // thousands of rows.

  private MAX_VISIBLE_ROWS = 9;
  private HEADER_HEIGHT = 41;
  private ROW_HEIGHT = 31;
  private PH = 'PH';

  private _isEdit = false;
  private _filter: (item: DtoForSaveKeyBase) => boolean;
  private _dataSource: DtoForSaveKeyBase[] = [];
  private _dataSourceCopy: DtoForSaveKeyBase[] = [];
  private _indexMap: number[] = [];

  @Input()
  set isEdit(v: boolean) {
    if (this._isEdit !== v) {
      this._isEdit = v;

      if (v && this._dataSourceCopy) {
        this.addPlaceholder(true);
      } else {
        this.removePlaceholder(true);
      }
    }
  }

  get isEdit(): boolean {
    return this._isEdit;
  }

  @Input()
  set dataSource(v: DtoForSaveKeyBase[]) {
    if (this._dataSource !== v) {
      this._dataSource = v;
      this.cloneAndMap();
    }
  }

  get dataSource(): DtoForSaveKeyBase[] {
    return this._dataSource;
  }

  @Input()
  columnPaths: string[] = [];

  @Input()
  columnTemplates: {
    [path: string]: {
      headerTemplate: TemplateRef<any>,
      rowTemplate: TemplateRef<any>,
      weight: number,
    }
  } = {};

  @Input()
  onNewItem: (item: DtoForSaveKeyBase) => DtoForSaveKeyBase;

  @Input()
  set filter(v: (item: DtoForSaveKeyBase) => boolean) {
    if (this._filter !== v) {
      this._filter = v;
      this.cloneAndMap();
    }
  }

  get filter(): (item: DtoForSaveKeyBase) => boolean {
    return this._filter;
  }

  @ViewChild(CdkVirtualScrollViewport)
  viewport: CdkVirtualScrollViewport;

  private cloneAndMap() {
    // To implement filter in a performant way and to support virtual scrolling and line numbering
    // we make a shallow copy of the provided data source together with an index map, and keep the
    // source and the copy synchronized
    this._dataSourceCopy = [];
    this._indexMap = [];
    if (!!this._dataSource) {
      const filter = this._filter || ((_: any) => true);
      for (let i = 0; i < this._dataSource.length; i++) {
        const item = this._dataSource[i];
        if (filter(item)) {
          this._dataSourceCopy.push(item);
          this._indexMap[this._dataSourceCopy.length - 1] = i;
        }
      }

      // This last item only to add a fake line to allow for add new line
      if (this.isEdit) {
        this.addPlaceholder(false);
      }
    }
  }

  private addPlaceholder(updateArray: boolean): void {

    let placeholder: DtoForSaveKeyBase = { Id: null, EntityState: 'Inserted' };
    if (this.onNewItem) {
      placeholder = this.onNewItem(placeholder);
    }

    placeholder[this.PH] = true;
    this._dataSourceCopy.push(placeholder);

    if (updateArray) {
      this._dataSourceCopy = this._dataSourceCopy.slice();
    }
  }

  private removePlaceholder(updateArray: boolean): void {
    if (!!this._dataSourceCopy && !!this._dataSourceCopy.length) {
      const placeholder = this._dataSourceCopy[this._dataSourceCopy.length - 1];
      if (placeholder[this.PH]) {
        this._dataSourceCopy.splice(this._dataSourceCopy.length - 1, 1);
      }
    }

    if (updateArray) {
      this._dataSourceCopy = this._dataSourceCopy.slice();
    }
  }

  constructor() { }

  ngOnInit() {
  }

  trackBy(item: DtoForSaveKeyBase) {
    return item.Id || item;
  }

  onDeleteLine(index: number) {
    const item = this._dataSourceCopy[index];
    if (item[this.PH]) {
      // Placeholders don't do anything
    } else if (item.EntityState === 'Inserted') {

      // remove from original
      const originalIndex = this.mapIndex(index);
      this._dataSource.splice(originalIndex, 1);

      // remove from copy
      const copyOfCopy = this._dataSourceCopy.slice();
      copyOfCopy.splice(index, 1);
      this._dataSourceCopy = copyOfCopy;

      // update index map
      this._indexMap.splice(index, 1);
      for (let i = index; i < this._indexMap.length; i++) {
        // This reduces all subsequent maps by
        // one to account for the deleted item
        this._indexMap[i]--;
      }
    } else {
      item['OS'] = item.EntityState; // remember original state
      item.EntityState = 'Deleted';
    }
  }

  onUndoDelete(index: number) {
    const item = this._dataSourceCopy[index];
    item.EntityState = item['OS'];
    delete item['OS'];
  }

  onUpdateLine = (item: DtoForSaveKeyBase) => {
    if (!item.EntityState) {
      item.EntityState = 'Updated';

    } else if (!!item[this.PH]) {
      // This is the add-new placeholder which appears as an extra line in edit mode
      // mark it as a proper item by deleting the PH flag
      delete item[this.PH];

      // Add the item to the original array
      this._dataSource.push(item);

      // add index map
      this._indexMap[this._dataSourceCopy.length - 1] = this._dataSource.length - 1;

      // Add a new placeholder to replace the old one
      this.addPlaceholder(true);
    }
  }

  // onAddNew() {
  //   this.onUpdateLine(this.dataSourceCopy[this.dataSourceCopy.length - 1]);
  // }

  colWith(colPath: string) {
    // This returns an html percentage width based on the weights assigned to this column and all the other columns

    // Get the weight of this column
    const weight = this.columnTemplates[colPath].weight || 1;

    // Get the total weight of the other columns
    let totalWeight = 0;
    for (let i = 0; i < this.columnPaths.length; i++) {
      const path = this.columnPaths[i];
      if (this.columnTemplates[path]) {
        totalWeight = totalWeight + (this.columnTemplates[path].weight || 1);
      }
    }

    // Calculate the percentage, (
    // if totalweight = 0 this method will never be called in the first place)
    return ((weight / totalWeight) * 100) + '%';
  }

  get showLineNumbers() {
    return false;
  }

  get visibleDataCount() {
    return !!this.dataSourceCopy ? this.dataSourceCopy.length : 0;
  }

  get dataSourceCopy() {
    return this._dataSourceCopy;
  }

  public mapIndex(index: number) {
    return this._indexMap[index];
  }

  get tableHeight(): string {
    const headerHeight = this.HEADER_HEIGHT;
    const rowHeight = this.ROW_HEIGHT;
    const maxVisibleRows = this.MAX_VISIBLE_ROWS;
    const actualRows = Math.max(this.dataSourceCopy.length, 3);
    const visibleRows = Math.min(maxVisibleRows, actualRows);
    const height = headerHeight + visibleRows * rowHeight;
    return (height + 10) + 'px';
  }

  get tableMaxHeight(): string {
    const headerHeight = this.HEADER_HEIGHT;
    const rowHeight = this.ROW_HEIGHT;
    const maxVisibleRows = this.MAX_VISIBLE_ROWS;
    const height = headerHeight + maxVisibleRows * rowHeight;
    return (height + 1) + 'px';
  }
}
