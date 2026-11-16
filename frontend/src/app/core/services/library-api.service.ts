import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type LibraryFolder = 'samples' | 'effects' | 'instruments';

export interface LibraryNodeDto {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: number;
  children?: LibraryNodeDto[];
}

export interface LibraryResponseDto {
  root: string;
  folders: {
    samples: LibraryNodeDto[];
    effects: LibraryNodeDto[];
    instruments: LibraryNodeDto[];
  };
}

export interface OpenFolderResponseDto {
  opened?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class LibraryApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getLibrary(): Observable<LibraryResponseDto> {
    return this.http.get<LibraryResponseDto>(`${this.baseUrl}/api/library`);
  }

  openFolder(folder: LibraryFolder): Observable<OpenFolderResponseDto> {
    return this.http.post<OpenFolderResponseDto>(`${this.baseUrl}/api/library/open`, { folder });
  }

  fileUrl(path: string): string {
    const encoded = path.split('/').map(part => encodeURIComponent(part)).join('/');
    return `${this.baseUrl}/api/library/file/${encoded}`;
  }
}
